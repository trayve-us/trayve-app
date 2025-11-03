import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { Page } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { authenticate } from "../config/shopify.server";
import { getShopifyUserByShop } from "../lib/auth";
import { getUserCreditBalance } from "../lib/credits";
import { UserProfile } from "../components/UserProfile";
import { CreditsDisplay } from "../components/CreditsDisplay";
import { Search, Trash2, X } from "lucide-react";
import { supabaseAdmin } from "~/lib/storage/supabase.server";
import { ConfirmationDialog } from "../components/ui/confirmation-dialog";
import { AlertDialog } from "../components/ui/alert-dialog";
import { TestingPanel } from "../components/TestingPanel";

interface GenerationResult {
  id: string;
  pose_id: number;
  pose_name: string;
  result_image_url: string;
  sample_index: number;
  created_at: string;
  image_url?: string;
  basic_upscale_url?: string;
  basic_upscale_status?: string;
  upscaled_image_url?: string;
  upscale_status?: string;
  face_swap_image_url?: string;
  face_swap_status?: string;
  generation_record?: {
    removed_bg_url?: string;
  };
}

interface Project {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  clothing_item_name?: string;
  clothing_type: string;
  clothing_image_url?: string;
  status: string;
  created_at: string;
  updated_at: string;
  result_count: number;
  generation_results: GenerationResult[];
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const user = await getShopifyUserByShop(shop);
  const balance = user ? await getUserCreditBalance(user.trayve_user_id) : null;

  console.log('═══════════════════════════════════════════════════════');
  console.log('📁 FETCHING USER PROJECTS');
  console.log('═══════════════════════════════════════════════════════');

  // Fetch projects from Supabase
  let projects: Project[] = [];
  if (user) {
    try {
      console.log(`👤 User ID: ${user.trayve_user_id}`);

      // Query user_generation_projects - fetch projects first
      const { data: projectsData, error: projectsError } = await supabaseAdmin
        .from('user_generation_projects')
        .select('*')
        .eq('user_id', user.trayve_user_id)
        .order('created_at', { ascending: false });

      if (projectsError) {
        console.error('❌ Error fetching projects:', projectsError);
        throw projectsError;
      }

      // For each project, fetch generation_results separately
      const projectsWithResults = await Promise.all(
        (projectsData || []).map(async (project: any) => {
          const { data: results, error: resultsError } = await supabaseAdmin
            .from('generation_results')
            .select('id, pose_id, pose_name, result_image_url, generation_metadata, created_at, removed_bg_url')
            .eq('project_id', project.id)
            .order('created_at', { ascending: false });

          if (resultsError) {
            console.error(`❌ Error fetching results for project ${project.id}:`, resultsError);
          }

          return {
            ...project,
            generation_results: results || []
          };
        })
      );

      const { data, error } = { data: projectsWithResults, error: null };

      if (error) {
        console.error('❌ Error fetching projects:', error);
      } else {
        console.log(`✅ Found ${data?.length || 0} projects`);
        
        // Transform data to match expected format
        projects = (data || []).map((project: any) => {
          const results = (project.generation_results || []).map((result: any) => {
            const metadata = result.generation_metadata || {};
            
            return {
              id: result.id,
              pose_id: result.pose_id,
              pose_name: result.pose_name || '',
              result_image_url: result.result_image_url || '',
              sample_index: 0,
              created_at: result.created_at,
              // Use try-on URL if available, otherwise result_image_url
              image_url: metadata.tryon_url || result.result_image_url || '',
              // 2K upscale (Free/Creator only)
              basic_upscale_url: metadata.basic_upscale_url || '',
              basic_upscale_status: metadata.basic_upscale_status || 'pending',
              // 4K upscale (Professional/Enterprise only)
              upscaled_image_url: metadata.upscaled_image_url || '',
              upscale_status: metadata.upscale_status || 'pending',
              // Face swap (Professional/Enterprise only)
              face_swap_image_url: metadata.face_swap_image_url || '',
              face_swap_status: metadata.face_swap_status || 'pending',
              // Background removal (from dedicated column, not metadata)
              generation_record: {
                removed_bg_url: result.removed_bg_url || ''
              }
            };
          });

          return {
            id: project.id,
            user_id: project.user_id,
            title: project.title || 'Untitled Project',
            description: project.description,
            clothing_item_name: project.clothing_item_name,
            clothing_type: project.clothing_type,
            clothing_image_url: project.clothing_image_url,
            status: project.status,
            created_at: project.created_at,
            updated_at: project.updated_at,
            result_count: results.length,
            generation_results: results,
          };
        });

        console.log(`📊 Projects summary:`);
        projects.forEach((project, idx) => {
          console.log(`  ${idx + 1}. ${project.title} - ${project.result_count} results`);
          // Debug: Show BG removal status
          project.generation_results.forEach((result, resultIdx) => {
            if (result.generation_record?.removed_bg_url) {
              console.log(`    ✂️ Result ${resultIdx + 1} has BG removed: ${result.generation_record.removed_bg_url.substring(0, 50)}...`);
            }
          });
        });
      }
    } catch (error) {
      console.error("❌ Error fetching projects:", error);
    }
  }

  console.log('═══════════════════════════════════════════════════════');

  return json({
    shop,
    user: user
      ? {
          email: user.shop_email || shop,
          shopName: user.shop_name || shop.replace(".myshopify.com", ""),
          trayveUserId: user.trayve_user_id,
        }
      : null,
    credits: balance
      ? {
          available: balance.available_credits,
          total: balance.total_credits,
        }
      : { available: 0, total: 0 },
    projects,
    testingMode: process.env.TESTING_MODE === "true",
  });
};

export default function Projects() {
  const { user, projects: initialProjects, credits, testingMode } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState({ title: "", description: "" });
  const [isDeleting, setIsDeleting] = useState(false);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Filter projects
  const filteredProjects = useMemo(() => {
    if (!debouncedSearchTerm.trim()) return projects;

    return projects.filter((project) => {
      const projectTitle = project.title || "Untitled Project";
      const matchesSearch =
        projectTitle.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        (project.clothing_item_name &&
          project.clothing_item_name
            .toLowerCase()
            .includes(debouncedSearchTerm.toLowerCase()));

      return matchesSearch;
    });
  }, [projects, debouncedSearchTerm]);

  // Get project cover image
  const getProjectCoverImage = useCallback((project: Project) => {
    if (
      project.generation_results &&
      Array.isArray(project.generation_results) &&
      project.generation_results.length > 0
    ) {
      const latestResult = project.generation_results[0];
      
      // Priority for cover image:
      // 1. Face swap (highest quality if available)
      // 2. 4K upscale (Professional/Enterprise)
      // 3. 2K upscale (Free/Creator)
      // 4. Try-on base image
      // 5. Fallback to result_image_url
      if (latestResult.face_swap_image_url) return latestResult.face_swap_image_url;
      if (latestResult.upscaled_image_url) return latestResult.upscaled_image_url;
      if (latestResult.basic_upscale_url) return latestResult.basic_upscale_url;
      if (latestResult.image_url) return latestResult.image_url;
      if (latestResult.result_image_url) return latestResult.result_image_url;
    }

    // Fallback to clothing image
    if (project.clothing_image_url) return project.clothing_image_url;

    return null;
  }, []);

  // Handle project click
  const handleProjectClick = useCallback(
    (projectId: string) => {
      // Navigate to generation results page
      navigate(`/app/generation-results/${projectId}`);
    },
    [navigate]
  );

  // Handle delete project
  const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    setProjectToDelete(projectId);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/projects/${projectToDelete}/delete`, {
        method: "DELETE",
      });

      if (response.ok) {
        setProjects(projects.filter((p) => p.id !== projectToDelete));
        setDeleteDialogOpen(false);
        setProjectToDelete(null);
      } else {
        const data = await response.json();
        setDeleteDialogOpen(false);
        setAlertMessage({
          title: "Delete Failed",
          description: `Failed to delete project: ${data.error || 'Unknown error'}`,
        });
        setAlertDialogOpen(true);
      }
    } catch (error) {
      console.error("Error deleting project:", error);
      setDeleteDialogOpen(false);
      setAlertMessage({
        title: "Delete Failed",
        description: "Failed to delete project. Please try again.",
      });
      setAlertDialogOpen(true);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Page fullWidth>
      <TitleBar title="Projects" />

      {/* TOP NAVBAR */}
      <div
        style={{
          backgroundColor: "white",
          borderBottom: "1px solid #E1E3E5",
          padding: "16px 24px",
          position: "sticky",
          top: 0,
          zIndex: 1000,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            maxWidth: "1400px",
            margin: "0 auto",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
            <img 
              src="/logo_trayve.png" 
              alt="Trayve" 
              style={{
                height: "32px",
                width: "auto",
              }}
            />
            
            {/* Navigation Tabs */}
            <nav style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => navigate("/app/studio")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#6b7280",
                  backgroundColor: "transparent",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#f9fafb";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                Generate
              </button>
              <button
                onClick={() => navigate("/app/projects")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#702dff",
                  backgroundColor: "rgba(112, 45, 255, 0.1)",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                Projects
              </button>
              <button
                onClick={() => navigate("/app/pricing")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#6b7280",
                  backgroundColor: "transparent",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#f9fafb";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                Pricing
              </button>
            </nav>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <CreditsDisplay />
            {user && <UserProfile email={user.email} shopName={user.shopName} />}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div
        style={{
          backgroundColor: "#FAFBFC",
          minHeight: "calc(100vh - 120px)",
          padding: "32px 24px",
        }}
      >
        <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
          {/* Search Bar */}
          <div style={{ marginBottom: "32px" }}>
            <div
              style={{
                position: "relative",
                maxWidth: "400px",
              }}
            >
              <Search
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "16px",
                  height: "16px",
                  color: "#6b7280",
                }}
              />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px 10px 40px",
                  border: "1px solid #E1E3E5",
                  borderRadius: "8px",
                  fontSize: "14px",
                  backgroundColor: "white",
                  outline: "none",
                }}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X style={{ width: "16px", height: "16px", color: "#6b7280" }} />
                </button>
              )}
            </div>
          </div>

          {/* Projects Grid */}
          {filteredProjects.length === 0 ? (
            <div
              style={{
                backgroundColor: "white",
                border: "2px dashed #E1E3E5",
                borderRadius: "12px",
                padding: "64px 24px",
                textAlign: "center",
              }}
            >
              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: "600",
                  color: "#202223",
                  marginBottom: "8px",
                }}
              >
                {searchTerm ? "No matching projects" : "No projects yet"}
              </h3>
              <p
                style={{
                  fontSize: "14px",
                  color: "#6b7280",
                  marginBottom: "24px",
                  maxWidth: "400px",
                  margin: "0 auto 24px",
                }}
              >
                {searchTerm
                  ? "Try adjusting your search terms to find what you're looking for."
                  : "Start creating stunning AI-generated fashion content with your first project."}
              </p>
              <button
                onClick={() => navigate("/app/studio")}
                style={{
                  backgroundColor: "#702dff",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  padding: "12px 24px",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#5c24cc";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#702dff";
                }}
              >
                Create First Project
              </button>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "24px",
              }}
            >
              {filteredProjects.map((project) => {
                const coverImage = getProjectCoverImage(project);
                const projectTitle = project.title || "Untitled Project";
                const createdDate = new Date(project.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });

                return (
                  <div
                    key={project.id}
                    onClick={() => handleProjectClick(project.id)}
                    style={{
                      backgroundColor: "white",
                      borderRadius: "12px",
                      overflow: "hidden",
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.12)";
                      e.currentTarget.style.transform = "translateY(-4px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.05)";
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    {/* Cover Image */}
                    <div style={{ position: "relative", paddingBottom: "133.33%" }}>
                      {coverImage ? (
                        <img
                          src={coverImage}
                          alt={projectTitle}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            objectPosition: "top",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: "#f9fafb",
                            color: "#6b7280",
                          }}
                        >
                          <div style={{ textAlign: "center", padding: "16px" }}>
                            <div style={{ fontSize: "48px", marginBottom: "8px" }}>
                              {project.status === "processing" || project.status === "active"
                                ? "⏳"
                                : ""}
                            </div>
                            <p style={{ fontSize: "12px", fontWeight: "500" }}>
                              {project.status === "processing"
                                ? "Processing..."
                                : project.status === "active"
                                ? "Generating..."
                                : "No preview"}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Delete Button */}
                      <button
                        onClick={(e) => handleDeleteProject(e, project.id)}
                        style={{
                          position: "absolute",
                          top: "12px",
                          right: "12px",
                          backgroundColor: "rgba(255, 255, 255, 0.9)",
                          border: "none",
                          borderRadius: "6px",
                          padding: "8px",
                          cursor: "pointer",
                          opacity: 0,
                          transition: "opacity 0.2s ease",
                        }}
                        className="delete-btn"
                      >
                        <Trash2 style={{ width: "16px", height: "16px", color: "#ef4444" }} />
                      </button>

                      {/* Results Count */}
                      {project.result_count > 0 && (
                        <div
                          style={{
                            position: "absolute",
                            bottom: "12px",
                            right: "12px",
                            backgroundColor: "rgba(255, 255, 255, 0.9)",
                            backdropFilter: "blur(8px)",
                            padding: "4px 12px",
                            borderRadius: "100px",
                            fontSize: "12px",
                            fontWeight: "500",
                            color: "#202223",
                          }}
                        >
                          {project.result_count} image{project.result_count !== 1 ? "s" : ""}
                        </div>
                      )}
                    </div>

                    {/* Project Info */}
                    <div style={{ padding: "16px" }}>
                      <h3
                        style={{
                          fontSize: "14px",
                          fontWeight: "600",
                          color: "#202223",
                          marginBottom: "4px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {projectTitle}
                      </h3>
                      {project.clothing_item_name && (
                        <p
                          style={{
                            fontSize: "12px",
                            color: "#6b7280",
                            marginBottom: "12px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {project.clothing_item_name}
                        </p>
                      )}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          fontSize: "12px",
                          color: "#6b7280",
                        }}
                      >
                        <span>{createdDate}</span>
                        <span
                          style={{
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: "500",
                            backgroundColor:
                              project.status === "completed"
                                ? "rgba(112, 45, 255, 0.1)"
                                : "#f3f4f6",
                            color: project.status === "completed" ? "#702dff" : "#6b7280",
                          }}
                        >
                          {project.status}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* CSS for hover effect on delete button */}
      <style>{`
        div:hover .delete-btn {
          opacity: 1 !important;
        }
      `}</style>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDeleteProject}
        title="Delete Project"
        description="Are you sure you want to delete this project? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        isLoading={isDeleting}
      />

      {/* Alert Dialog */}
      <AlertDialog
        open={alertDialogOpen}
        onOpenChange={setAlertDialogOpen}
        title={alertMessage.title}
        description={alertMessage.description}
        variant="error"
      />

      {/* Testing Panel - Only visible in testing mode */}
      {testingMode && (
        <TestingPanel currentCredits={credits.available} />
      )}
    </Page>
  );
}
