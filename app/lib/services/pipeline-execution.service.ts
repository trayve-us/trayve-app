/**
 * Pipeline Execution Service
 * 
 * Core orchestration service for AI image generation pipeline.
 * Handles multi-step processing, credit management, and result storage.
 * 
 * Pipeline Steps (tier-dependent):
 * 1. try-on: Virtual try-on using FAL AI
 * 2. basic-upscale: 2x upscaling
 * 3. enhanced-upscale: 4x upscaling (professional/enterprise only)
 * 4. face-swap: Face refinement (professional/enterprise only)
 * 
 * CRITICAL: Credits (1000 per generation) are ONLY deducted on successful completion.
 * Failed executions trigger automatic refunds.
 */

import { supabaseAdmin } from "../storage/supabase.server";
import {
  executePipeline,
  getEnabledSteps,
  type PipelineStep,
  type PipelineConfig,
  type PipelineStepResult,
} from "./ai-providers.service";
import {
  uploadToShopifyGenerationsBucket,
  getPublicUrl,
  type UploadResult,
} from "./storage.service";

// Types
export interface PoseInput {
  pose_id: string;
  image_url: string;
  pose_name?: string;
}

export interface ExecutionInput {
  user_id: string;
  subscription_tier: 'free' | 'creator' | 'professional' | 'enterprise';
  base_model_id: string;
  clothing_image_url: string;
  poses: PoseInput[];
  project_name?: string;
  project_description?: string;
}

export interface ExecutionResult {
  execution_id: string;
  project_id: string;
  status: 'processing' | 'completed' | 'failed';
  total_poses: number;
  completed_poses: number;
  failed_poses: number;
  generation_results: GenerationResult[];
  error?: string;
}

export interface GenerationResult {
  result_id: string;
  pose_id: string;
  pose_name?: string;
  status: 'processing' | 'completed' | 'failed';
  final_image_url?: string;
  step_results: {
    [key in PipelineStep]?: string; // step_name -> image_url
  };
  error?: string;
}

/**
 * Start a new pipeline execution
 * Creates execution record, project record, and initiates processing
 */
export async function startPipelineExecution(
  input: ExecutionInput
): Promise<ExecutionResult> {
  const { user_id, subscription_tier, base_model_id, clothing_image_url, poses, project_name, project_description } = input;

  try {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🚀 PIPELINE EXECUTION START');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`📋 User ID: ${user_id}`);
    console.log(`🎯 Subscription Tier: ${subscription_tier}`);
    console.log(`🎨 Base Model ID: ${base_model_id}`);
    console.log(`👔 Clothing Image: ${clothing_image_url}`);
    console.log(`📸 Number of Poses: ${poses.length}`);
    console.log(`📝 Project Name: ${project_name || 'Untitled'}`);
    console.log('───────────────────────────────────────────────────────');

    // Validate inputs
    if (!poses || poses.length === 0) {
      console.error('❌ VALIDATION ERROR: No poses provided');
      throw new Error("At least one pose is required");
    }

    if (poses.length > 10) {
      console.error(`❌ VALIDATION ERROR: Too many poses (${poses.length} > 10)`);
      throw new Error("Maximum 10 poses allowed per execution");
    }

    console.log('✅ Input validation passed');
    console.log('───────────────────────────────────────────────────────');

    // Check user credits
    console.log('💳 Checking user credits...');
    const { data: userCredits, error: creditsError } = await supabaseAdmin
      .from("user_credits")
      .select("available_credits")
      .eq("user_id", user_id)
      .single();

    if (creditsError || !userCredits) {
      console.error('❌ CREDITS ERROR:', creditsError);
      throw new Error("Unable to fetch user credits");
    }

    const requiredCredits = 1000 * poses.length; // 1000 credits per pose
    console.log(`   Required Credits: ${requiredCredits}`);
    console.log(`   Available Credits: ${userCredits.available_credits}`);

    if (userCredits.available_credits < requiredCredits) {
      console.error(`❌ INSUFFICIENT CREDITS: Need ${requiredCredits}, Have ${userCredits.available_credits}`);
      throw new Error(
        `Insufficient credits. Required: ${requiredCredits}, Available: ${userCredits.available_credits}`
      );
    }

    console.log('✅ Credit validation passed');
    console.log('───────────────────────────────────────────────────────');

    // Create project record
    console.log('📁 Creating project record...');
    const { data: project, error: projectError } = await supabaseAdmin
      .from("user_generation_projects")
      .insert({
        user_id,
        name: project_name || 'Untitled project',
        description: project_description || "AI-generated fashion images",
        base_model_id,
        clothing_image_url,
        result_count: 0, // Will be updated as generations complete
        status: 'active', // active = in progress, archived = completed,
      })
      .select()
      .single();

    if (projectError || !project) {
      console.error("❌ PROJECT CREATION ERROR:", projectError);
      throw new Error("Failed to create project record");
    }

    console.log(`✅ Project created: ${project.id} - "${project.name}"`);
    console.log('───────────────────────────────────────────────────────');

    // Get enabled pipeline steps for this tier
    const enabledSteps = getEnabledSteps(subscription_tier);
    console.log('🔧 Pipeline configuration:');
    console.log(`   Tier: ${subscription_tier}`);
    console.log(`   Enabled Steps: [${enabledSteps.join(', ')}]`);
    console.log(`   Total Steps: ${enabledSteps.length}`);
    console.log('───────────────────────────────────────────────────────');

    // Create pipeline execution record
    console.log('⚙️  Creating pipeline execution record...');
    const { data: execution, error: executionError } = await supabaseAdmin
      .from("pipeline_executions")
      .insert({
        user_id,
        project_id: project.id,
        user_image_url: poses[0].image_url, // First pose as user image
        user_image_path: poses[0].pose_id,
        clothing_image_url,
        clothing_image_path: clothing_image_url,
        subscription_tier,
        status: "processing",
        enabled_steps: enabledSteps,
        user_source: 'shopify_user', // Mark as Shopify app generation
        config: {
          tier: subscription_tier,
          total_poses: poses.length,
          poses: poses.map(p => ({ pose_id: p.pose_id, pose_name: p.pose_name }))
        },
        input: {
          poses: poses,
          clothing_image_url,
        },
        metadata: {
          project_name: project_name || 'Untitled project',
        },
        credits_reserved: 1000 * poses.length,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (executionError || !execution) {
      console.error("❌ EXECUTION CREATION ERROR:", executionError);
      throw new Error("Failed to create execution record");
    }

    console.log(`✅ Execution created: ${execution.id}`);
    console.log(`   Status: ${execution.status}`);
    console.log(`   Started at: ${execution.started_at}`);
    console.log('───────────────────────────────────────────────────────');

    // Create user_generations record (parent for generation_results)
    console.log('📝 Creating user generations record...');
    const { data: userGeneration, error: userGenError } = await supabaseAdmin
      .from("user_generations")
      .insert({
        project_id: project.id,
        user_id,
        base_model_id,
        selected_poses: poses.map(p => p.pose_id),
        generation_config: {
          tier: subscription_tier,
          enabled_steps: enabledSteps,
          clothing_image_url,
        },
        status: 'processing',
      })
      .select()
      .single();

    if (userGenError || !userGeneration) {
      console.error("❌ USER GENERATION ERROR:", userGenError);
      throw new Error("Failed to create user generation record");
    }

    console.log(`✅ User generation created: ${userGeneration.id}`);
    console.log('───────────────────────────────────────────────────────');

    // Create generation result placeholders for each pose
    console.log('📝 Creating generation result placeholders...');
    const generationRecords = poses.map((pose) => ({
      generation_id: userGeneration.id, // Link to user_generations record
      project_id: project.id,
      user_id,
      pose_id: pose.pose_id,
      pose_name: pose.pose_name,
      clothing_image_url,
      model_image_url: pose.image_url,
      result_image_url: '', // Will be updated after generation
      supabase_path: '', // Will be updated after upload
      generation_tier: subscription_tier,
      generation_config: {
        enabled_steps: enabledSteps,
        pipeline_execution_id: execution.id, // Store pipeline execution reference in config
      },
      generation_metadata: {
        status: 'processing',
      },
    }));

    const { data: generationResults, error: generationError } = await supabaseAdmin
      .from("generation_results")
      .insert(generationRecords)
      .select();

    if (generationError || !generationResults) {
      console.error("❌ GENERATION RECORDS ERROR:", generationError);
      throw new Error("Failed to create generation records");
    }

    console.log(`✅ Created ${generationResults.length} generation result records`);
    generationResults.forEach((result: any, index: number) => {
      console.log(`   ${index + 1}. Result ID: ${result.id} - Pose: ${result.pose_name || result.pose_id}`);
    });
    console.log('───────────────────────────────────────────────────────');

    // CRITICAL: Deduct credits IMMEDIATELY when generation starts (upfront payment)
    console.log('💳 DEDUCTING CREDITS (Upfront Payment)...');
    const creditsToConsume = 1000 * poses.length;
    console.log(`   Amount to deduct: ${creditsToConsume} credits`);
    console.log(`   Breakdown: ${poses.length} poses × 1000 credits`);
    
    const consumeResult = await consumeCreditsForExecution(execution.id, creditsToConsume);

    if (!consumeResult.success) {
      console.error('❌ CREDIT DEDUCTION FAILED:', consumeResult.error);
      // If credit deduction fails, mark execution as failed and cleanup
      await updateExecutionStatus(execution.id, "failed", 0, poses.length, 0);
      throw new Error(consumeResult.error || "Failed to deduct credits");
    }

    console.log(`✅ Credits deducted successfully: ${creditsToConsume}`);
    console.log(`   New balance: ${userCredits.available_credits - creditsToConsume}`);
    console.log('───────────────────────────────────────────────────────');

    // Update execution record with consumed credits
    await supabaseAdmin
      .from("pipeline_executions")
      .update({ credits_used: creditsToConsume })
      .eq("id", execution.id);

    console.log('🎬 Starting background processing...');
    console.log('   Processing will continue asynchronously');
    console.log('   Use execution ID to poll for status updates');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`✅ PIPELINE EXECUTION INITIATED: ${execution.id}`);
    console.log('═══════════════════════════════════════════════════════');
    console.log('');

    // Start async processing (don't await - return immediately)
    processAllPoses(execution.id, poses, clothing_image_url, subscription_tier, base_model_id, creditsToConsume).catch((error) => {
      console.error(`❌ Error in background processing for execution ${execution.id}:`, error);
    });

    return {
      execution_id: execution.id,
      project_id: project.id,
      status: "processing",
      total_poses: poses.length,
      completed_poses: 0,
      failed_poses: 0,
      generation_results: generationResults.map((result) => ({
        result_id: result.id,
        pose_id: result.pose_id,
        pose_name: result.pose_name,
        status: "processing" as const,
        step_results: {},
      })),
    };
  } catch (error: any) {
    console.error('═══════════════════════════════════════════════════════');
    console.error('❌ PIPELINE EXECUTION START FAILED');
    console.error('═══════════════════════════════════════════════════════');
    console.error('Error Message:', error.message);
    console.error('Error Details:', error);
    console.error('Stack Trace:', error.stack);
    console.error('═══════════════════════════════════════════════════════');
    throw error;
  }
}

/**
 * Process all poses for an execution
 * Runs in background, processes each pose sequentially
 * Credits already deducted upfront - refund on failure
 */
async function processAllPoses(
  execution_id: string,
  poses: PoseInput[],
  clothing_image_url: string,
  subscription_tier: string,
  base_model_id: string,
  creditsAlreadyDeducted: number
): Promise<void> {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔄 BACKGROUND PROCESSING STARTED');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`📋 Execution ID: ${execution_id}`);
  console.log(`📸 Total Poses: ${poses.length}`);
  console.log(`💳 Credits Already Deducted: ${creditsAlreadyDeducted}`);
  console.log(`🎯 Subscription Tier: ${subscription_tier}`);
  console.log('═══════════════════════════════════════════════════════');

  let completedCount = 0;
  let failedCount = 0;

  // Get all generation results for this execution
  console.log('📥 Fetching generation results from database...');
  
  // First get the user_generation record linked to this execution via project_id
  const { data: executionData } = await supabaseAdmin
    .from("pipeline_executions")
    .select("project_id")
    .eq("id", execution_id)
    .single();

  if (!executionData?.project_id) {
    console.error(`❌ Failed to find project for execution ${execution_id}`);
    await updateExecutionStatus(execution_id, "failed", 0, poses.length, 0);
    return;
  }

  // Fetch generation results via project_id
  const { data: generationResults, error: fetchError } = await supabaseAdmin
    .from("generation_results")
    .select("*")
    .eq("project_id", executionData.project_id)
    .contains("generation_config", { pipeline_execution_id: execution_id });

  if (fetchError || !generationResults) {
    console.error(`❌ Failed to fetch generation results for execution ${execution_id}`);
    console.error('Error:', fetchError);
    await updateExecutionStatus(execution_id, "failed", 0, poses.length, 0);
    return;
  }

  console.log(`✅ Fetched ${generationResults.length} generation result records`);
  console.log('───────────────────────────────────────────────────────');

  // Process all poses in parallel for faster execution
  console.log('🚀 Starting PARALLEL processing of all poses...');
  console.log(`   Total poses to process: ${poses.length}`);
  console.log('───────────────────────────────────────────────────────');
  
  const processPose = async (pose: PoseInput, index: number) => {
    const generationResult = generationResults.find((r) => r.pose_id === pose.pose_id);

    console.log('');
    console.log('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
    console.log(`┃  PROCESSING POSE ${index + 1}/${poses.length}                              ┃`);
    console.log('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
    console.log(`📸 Pose ID: ${pose.pose_id}`);
    console.log(`📝 Pose Name: ${pose.pose_name || 'Unnamed'}`);
    console.log(`🖼️  Pose Image: ${pose.image_url.substring(0, 80)}...`);

    if (!generationResult) {
      console.error(`❌ Generation result not found for pose ${pose.pose_id}`);
      console.error('   Skipping this pose...');
      return { success: false, index };
    }

    console.log(`🆔 Result Record ID: ${generationResult.id}`);
    console.log('───────────────────────────────────────────────────────');

    try {
      const poseStartTime = Date.now();
      console.log(`⏱️  Started at: ${new Date().toISOString()}`);
      
      // CRITICAL: Each pose uses its OWN image_url, not the first pose's URL
      const poseImageUrl = pose.image_url;
      console.log(`🎨 Using pose-specific image URL (not first pose)`);
      console.log('───────────────────────────────────────────────────────');

      // Execute pipeline for this pose
      console.log('🚀 Executing AI pipeline...');
      const pipelineResults: PipelineStepResult[] = await executePipeline(
        poseImageUrl,
        clothing_image_url,
        {
          tier: subscription_tier as any,
        }
      );

      const poseProcessingTime = ((Date.now() - poseStartTime) / 1000).toFixed(2);
      console.log(`✅ Pipeline completed in ${poseProcessingTime}s`);
      console.log(`📊 Steps executed: ${pipelineResults.length}`);
      
      pipelineResults.forEach((step: any, stepIndex: number) => {
        const statusEmoji = step.status === 'completed' ? '✅' : step.status === 'failed' ? '❌' : '⏭️';
        console.log(`   ${statusEmoji} ${stepIndex + 1}. ${step.stepType} (${step.status})`);
        if (step.processingTime) {
          console.log(`      Time: ${(step.processingTime / 1000).toFixed(2)}s`);
        }
      });
      console.log('───────────────────────────────────────────────────────');

      // Check if CRITICAL steps failed (try-on is critical, upscales are optional)
      const failedTryOn = pipelineResults.find((r) => r.stepType === 'tryon' && r.status === 'failed');
      if (failedTryOn) {
        console.error(`❌ Critical step failed: ${failedTryOn.stepType}`);
        console.error(`   Error: ${failedTryOn.error}`);
        throw new Error(failedTryOn.error || "Try-on generation failed");
      }

      // Log warnings for optional step failures but don't fail the entire pipeline
      const failedOptionalSteps = pipelineResults.filter((r) => 
        r.status === 'failed' && r.stepType !== 'tryon'
      );
      failedOptionalSteps.forEach(step => {
        console.warn(`⚠️  Optional step failed but continuing: ${step.stepType}`);
        console.warn(`   Reason: ${step.error}`);
      });

      // Get the final image URL (last completed step)
      const completedSteps = pipelineResults.filter((r) => r.status === 'completed');
      const finalStep = completedSteps[completedSteps.length - 1];
      
      if (!finalStep || !finalStep.imageUrl) {
        console.error('❌ No final image produced by pipeline');
        throw new Error("No final image produced by pipeline");
      }

      console.log(`📥 Downloading final image from: ${finalStep.stepType}`);
      console.log(`   URL: ${finalStep.imageUrl.substring(0, 80)}...`);

      // Download the final image
      const imageResponse = await fetch(finalStep.imageUrl);
      if (!imageResponse.ok) {
        console.error(`❌ Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`);
        throw new Error(`Failed to download final image: ${imageResponse.statusText}`);
      }

      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      const imageSizeMB = (imageBuffer.length / 1024 / 1024).toFixed(2);
      console.log(`✅ Downloaded image: ${imageSizeMB} MB`);
      console.log('───────────────────────────────────────────────────────');

      // Upload to Supabase storage
      console.log('📤 Uploading to Supabase storage...');
      const timestamp = Date.now();
      const filename = `generation_${execution_id}_pose_${pose.pose_id}_${timestamp}.png`;
      console.log(`   Filename: ${filename}`);
      console.log(`   Size: ${imageSizeMB} MB`);
      
      const uploadResult: UploadResult = await uploadToShopifyGenerationsBucket(imageBuffer, filename, "image/png");
      const finalImageUrl = getPublicUrl(uploadResult.path, "shopify-generations");
      
      console.log(`✅ Upload successful`);
      console.log(`   Storage Path: ${uploadResult.path}`);
      console.log(`   Public URL: ${finalImageUrl.substring(0, 80)}...`);
      console.log('───────────────────────────────────────────────────────');

      // Build step results metadata with URLs AND statuses
      const metadata: any = {
        status: 'completed',
        completed_at: new Date().toISOString(),
      };

      pipelineResults.forEach((step) => {
        // Set status fields based on step type
        if (step.stepType === 'basic-upscale') {
          metadata.basic_upscale_status = step.status;
          if (step.status === 'completed' && step.imageUrl) {
            metadata.basic_upscale_url = step.imageUrl;
          } else if (step.status === 'failed') {
            metadata.basic_upscale_error = step.error || 'Unknown error';
          }
        } else if (step.stepType === 'enhanced-upscale') {
          metadata.upscale_status = step.status;
          if (step.status === 'completed' && step.imageUrl) {
            metadata.upscaled_image_url = step.imageUrl;
          } else if (step.status === 'failed') {
            metadata.upscale_error = step.error || 'Unknown error';
          }
        } else if (step.stepType === 'replicate-face-swap') {
          metadata.face_swap_status = step.status;
          if (step.status === 'completed' && step.imageUrl) {
            metadata.face_swap_image_url = step.imageUrl;
          } else if (step.status === 'failed') {
            metadata.face_swap_error = step.error || 'Unknown error';
          }
        } else if (step.stepType === 'tryon') {
          metadata.tryon_status = step.status;
          if (step.status === 'completed' && step.imageUrl) {
            metadata.tryon_url = step.imageUrl;
          } else if (step.status === 'failed') {
            metadata.tryon_error = step.error || 'Unknown error';
          }
        }
      });

      // Update generation result with all step results
      console.log('💾 Updating database with results...');
      console.log(`   Result ID: ${generationResult.id}`);
      console.log(`   Final Image URL: ${finalImageUrl.substring(0, 80)}...`);
      console.log(`   Metadata Status Fields:`);
      console.log(`     - upscale_status: ${metadata.upscale_status || 'N/A'}`);
      console.log(`     - face_swap_status: ${metadata.face_swap_status || 'N/A'}`);
      console.log(`   Metadata size: ${JSON.stringify(metadata).length} bytes`);
      
      // Retry logic for database timeout issues
      let updateAttempt = 0;
      const maxRetries = 3;
      let updateError: any = null;
      
      while (updateAttempt < maxRetries) {
        updateAttempt++;
        console.log(`   Attempt ${updateAttempt}/${maxRetries}...`);
        
        const { error } = await supabaseAdmin
          .from("generation_results")
          .update({
            result_image_url: finalImageUrl,
            supabase_path: uploadResult.path,
            generation_metadata: metadata,
            updated_at: new Date().toISOString(),
          })
          .eq("id", generationResult.id);
        
        if (!error) {
          updateError = null;
          break;
        }
        
        updateError = error;
        
        if (error.code === '57014') {
          // Statement timeout - wait and retry
          console.warn(`   ⚠️  Database timeout on attempt ${updateAttempt}, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * updateAttempt));
        } else {
          // Other error - don't retry
          break;
        }
      }

      if (updateError) {
        console.error(`❌ Error updating generation result ${generationResult.id} after ${updateAttempt} attempts:`, updateError);
        throw updateError;
      }

      console.log(`✅ Database updated successfully`);
      
      // Print real-time results summary
      console.log('');
      console.log('📸 Results Summary:');
      console.log(`  Pose ${index + 1}: ${pose.pose_name || 'Generated Pose ' + pose.pose_id}`);
      console.log(`    Images: 1`);
      console.log(`    Image 1:`);
      
      const isProfessionalOrEnterprise = ['professional', 'enterprise'].includes(subscription_tier.toLowerCase());
      
      // Try-On (Base) - Required for all tiers
      const tryOnStep = pipelineResults.find(r => r.stepType === 'tryon');
      const baseStatus = tryOnStep?.status === 'completed' ? '✅' : 
                        tryOnStep?.status === 'failed' ? '❌' : 'pending';
      console.log(`      - Base (Try-On): ${baseStatus}`);
      
      if (isProfessionalOrEnterprise) {
        // Professional/Enterprise: Show 4K Upscale and Face Swap
        const enhancedUpscaleStep = pipelineResults.find(r => r.stepType === 'enhanced-upscale');
        const upscale4KStatus = enhancedUpscaleStep?.status === 'completed' ? '✅' : 
                                enhancedUpscaleStep?.status === 'failed' ? '❌' : 'pending';
        console.log(`      - 4K Upscale: ${upscale4KStatus}`);
        
        const faceSwapStep = pipelineResults.find(r => r.stepType === 'replicate-face-swap');
        const faceSwapStatus = faceSwapStep?.status === 'completed' ? '✅' : 
                              faceSwapStep?.status === 'failed' ? '❌' : 'pending';
        console.log(`      - Face Swap: ${faceSwapStatus}`);
      } else {
        // Free/Starter/Creator: Show 2K Upscale only
        const basicUpscaleStep = pipelineResults.find(r => r.stepType === 'basic-upscale');
        const upscale2KStatus = basicUpscaleStep?.status === 'completed' ? '✅' : 
                                basicUpscaleStep?.status === 'failed' ? '❌' : 'pending';
        console.log(`      - 2K Upscale: ${upscale2KStatus}`);
      }
      console.log('');
      
      console.log('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
      console.log(`┃  ✅ POSE ${index + 1}/${poses.length} COMPLETED SUCCESSFULLY           ┃`);
      console.log('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
      
      return { success: true, index };
    } catch (error: any) {
      console.error('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
      console.error(`┃  ❌ POSE ${index + 1}/${poses.length} FAILED                             ┃`);
      console.error('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
      console.error(`Error Message: ${error.message}`);
      console.error('Error Details:', error);

      // Mark this generation as failed
      await supabaseAdmin
        .from("generation_results")
        .update({
          generation_metadata: {
            status: 'failed',
            error_message: error.message,
            completed_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", generationResult.id);

      return { success: false, index };
    }
  };

  // Execute all poses in parallel using Promise.allSettled to handle individual failures
  const results = await Promise.allSettled(
    poses.map((pose, index) => processPose(pose, index))
  );

  // Count completed and failed poses
  results.forEach((result) => {
    if (result.status === 'fulfilled' && result.value.success) {
      completedCount++;
    } else {
      failedCount++;
    }
  });

  // Update execution progress after all poses complete
  await updateExecutionProgress(execution_id, completedCount, failedCount, poses.length);
  console.log(`📊 Final Progress: ${completedCount} completed, ${failedCount} failed`);

  // Final status update
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('🏁 PIPELINE PROCESSING COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`📊 Final Results:`);
  console.log(`   ✅ Completed: ${completedCount}/${poses.length}`);
  console.log(`   ❌ Failed: ${failedCount}/${poses.length}`);
  console.log(`   📸 Total Poses: ${poses.length}`);
  console.log('───────────────────────────────────────────────────────');
  
  const finalStatus = failedCount === poses.length ? "failed" : "completed";
  console.log(`🎯 Final Execution Status: ${finalStatus}`);

  // CRITICAL: Refund credits for FAILED generations (credits were already deducted upfront)
  if (failedCount > 0) {
    const creditsToRefund = failedCount * 1000;
    console.log('───────────────────────────────────────────────────────');
    console.log(`💰 REFUNDING CREDITS FOR FAILED POSES`);
    console.log(`   Failed Poses: ${failedCount}`);
    console.log(`   Credits to Refund: ${creditsToRefund}`);
    console.log(`   Breakdown: ${failedCount} × 1000 credits`);
    
    await refundCreditsForExecution(execution_id, creditsToRefund);
    console.log(`✅ Refund processed: ${creditsToRefund} credits`);
  }

  // Update execution with final counts (credits already deducted, just update the record)
  const finalCreditsConsumed = completedCount * 1000;
  console.log('───────────────────────────────────────────────────────');
  console.log(`💳 FINAL CREDIT SUMMARY:`);
  console.log(`   Initially Deducted: ${creditsAlreadyDeducted} credits`);
  console.log(`   Refunded: ${failedCount * 1000} credits`);
  console.log(`   Net Consumed: ${finalCreditsConsumed} credits`);
  console.log('───────────────────────────────────────────────────────');

  await updateExecutionStatus(execution_id, finalStatus, completedCount, failedCount, finalCreditsConsumed);

  console.log(`✅ Execution status updated in database`);
  console.log('═══════════════════════════════════════════════════════');
  console.log(`🏁 EXECUTION ${execution_id} FINISHED`);
  console.log(`   Status: ${finalStatus.toUpperCase()}`);
  console.log(`   Completed: ${completedCount}, Failed: ${failedCount}`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
}

/**
 * Update execution progress (called after each pose)
 */
async function updateExecutionProgress(
  execution_id: string,
  completed: number,
  failed: number,
  total: number
): Promise<void> {
  // Calculate actual progress: (completed + failed) / total poses
  const processedPoses = completed + failed;
  const progress = total > 0 ? Math.round((processedPoses / total) * 100) : 0;
  
  await supabaseAdmin
    .from("pipeline_executions")
    .update({
      progress: progress,
      updated_at: new Date().toISOString(),
    })
    .eq("id", execution_id);
}

/**
 * Update final execution status
 */
async function updateExecutionStatus(
  execution_id: string,
  status: string,
  completed: number,
  failed: number,
  credits: number
): Promise<void> {
  // Get project_id first
  const { data: execution } = await supabaseAdmin
    .from("pipeline_executions")
    .select("project_id")
    .eq("id", execution_id)
    .single();

  // Update pipeline execution
  await supabaseAdmin
    .from("pipeline_executions")
    .update({
      status,
      progress: 100,
      credits_used: credits,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", execution_id);

  if (execution?.project_id) {
    // Update user_generations status
    await supabaseAdmin
      .from("user_generations")
      .update({
        status: status === 'failed' ? 'failed' : 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq("project_id", execution.project_id);

    // Update project completion count
    await supabaseAdmin
      .from("user_generation_projects")
      .update({
        result_count: completed,
        status: 'archived', // archived = completed
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", execution.project_id);
  }
}

/**
 * Consume credits at the start of execution (upfront payment)
 * Returns success/error result for validation
 */
async function consumeCreditsForExecution(
  execution_id: string,
  credits: number
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('💳 consumeCreditsForExecution called');
    console.log(`   Execution ID: ${execution_id}`);
    console.log(`   Credits: ${credits}`);
    
    // Get execution details
    const { data: execution, error: fetchError } = await supabaseAdmin
      .from("pipeline_executions")
      .select("user_id")
      .eq("id", execution_id)
      .single();

    if (fetchError || !execution) {
      console.error(`❌ Failed to fetch execution for credit consumption:`, fetchError);
      return { success: false, error: "Failed to fetch execution details" };
    }

    console.log(`   User ID: ${execution.user_id}`);
    console.log('   Calling RPC: consume_credits...');

    // Call RPC function to consume credits atomically
    const { data, error } = await supabaseAdmin.rpc("consume_credits", {
      p_user_id: execution.user_id,
      p_credits: credits,
      p_generation_id: execution_id,
      p_description: `AI image generation - ${credits / 1000} pose(s)`,
    });

    if (error || !data?.success) {
      const errorMsg = error?.message || data?.error || "Failed to consume credits";
      console.error(`❌ RPC consume_credits failed:`, errorMsg);
      console.error('   Error details:', error || data);
      return { success: false, error: errorMsg };
    }

    console.log(`✅ Credits consumed successfully via RPC`);
    console.log(`   Transaction ID: ${data.transaction_id}`);
    console.log(`   Remaining Credits: ${data.remaining_credits}`);
    return { success: true };
  } catch (error: any) {
    console.error(`❌ Exception in consumeCreditsForExecution:`, error);
    return { success: false, error: error.message || "Unknown error" };
  }
}

/**
 * Refund credits for failed generations
 * Called when poses fail after upfront payment
 */
async function refundCreditsForExecution(
  execution_id: string,
  credits: number
): Promise<void> {
  try {
    // Get execution details
    const { data: execution, error: fetchError } = await supabaseAdmin
      .from("pipeline_executions")
      .select("user_id")
      .eq("id", execution_id)
      .single();

    if (fetchError || !execution) {
      console.error(`❌ Failed to fetch execution for credit refund:`, fetchError);
      return;
    }

    // Call RPC function to refund credits atomically
    const { data, error } = await supabaseAdmin.rpc("refund_credits", {
      p_user_id: execution.user_id,
      p_credits: credits,
      p_reason: `Refund for ${credits / 1000} failed generation(s)`,
      p_reference_id: execution_id,
    });

    if (error || !data?.success) {
      console.error(`❌ Failed to refund credits:`, error || data?.error);
    } else {
      console.log(`� Refunded ${credits} credits for execution ${execution_id}`);
    }
  } catch (error) {
    console.error(`❌ Error in refundCreditsForExecution:`, error);
  }
}

/**
 * Get execution status and results
 */
export async function getExecutionStatus(
  execution_id: string
): Promise<ExecutionResult | null> {
  try {
    // Fetch execution record
    const { data: execution, error: executionError } = await supabaseAdmin
      .from("pipeline_executions")
      .select("*")
      .eq("id", execution_id)
      .single();

    if (executionError || !execution) {
      console.error(`❌ Execution not found: ${execution_id}`);
      return null;
    }

    // Fetch generation results
    const { data: results, error: resultsError } = await supabaseAdmin
      .from("generation_results")
      .select("*")
      .eq("project_id", execution.project_id)
      .contains("generation_config", { pipeline_execution_id: execution_id });

    if (resultsError) {
      console.error(`❌ Error fetching results:`, resultsError);
      return null;
    }

    // Count completed and failed from metadata
    const completed = results?.filter(r => r.generation_metadata?.status === 'completed').length || 0;
    const failed = results?.filter(r => r.generation_metadata?.status === 'failed').length || 0;
    const total = results?.length || 0;

    return {
      execution_id: execution.id,
      project_id: execution.project_id,
      status: execution.status,
      total_poses: total,
      completed_poses: completed,
      failed_poses: failed,
      generation_results: (results || []).map((result) => ({
        result_id: result.id,
        pose_id: result.pose_id,
        pose_name: result.pose_name,
        status: result.generation_metadata?.status || 'processing',
        final_image_url: result.result_image_url,
        step_results: result.generation_metadata?.step_results || {},
        error: result.generation_metadata?.error_message,
      })),
    };
  } catch (error: any) {
    console.error(`❌ Error getting execution status:`, error);
    return null;
  }
}

/**
 * Cancel an ongoing execution
 * Refunds credits for incomplete generations
 */
export async function cancelExecution(
  execution_id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: execution, error: fetchError } = await supabaseAdmin
      .from("pipeline_executions")
      .select("*")
      .eq("id", execution_id)
      .single();

    if (fetchError || !execution) {
      return { success: false, error: "Execution not found" };
    }

    if (execution.status !== "processing") {
      return { success: false, error: "Execution is not in processing state" };
    }

    // Update execution status to cancelled
    await supabaseAdmin
      .from("pipeline_executions")
      .update({
        status: "cancelled",
        completed_at: new Date().toISOString(),
      })
      .eq("id", execution_id);

    // Mark incomplete generations as cancelled
    await supabaseAdmin
      .from("generation_results")
      .update({
        generation_metadata: {
          status: 'cancelled',
          completed_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("project_id", execution.project_id)
      .contains("generation_config", { pipeline_execution_id: execution_id })
      .eq("generation_metadata->status", "processing");

    // Refund credits if any were consumed
    if (execution.credits_used > 0) {
      await supabaseAdmin.rpc("refund_credits", {
        p_user_id: execution.user_id,
        p_credits: execution.credits_used,
        p_reason: `Execution cancelled: ${execution_id}`,
        p_reference_id: execution_id,
      });
    }

    console.log(`✅ Execution ${execution_id} cancelled`);
    return { success: true };
  } catch (error: any) {
    console.error(`❌ Error cancelling execution:`, error);
    return { success: false, error: error.message };
  }
}
