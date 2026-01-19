export type VertexPromptMode = 'social_media' | 'product_shots';
export type Gender = 'male' | 'female';

interface VertexPromptInputs {
    mode: VertexPromptMode;
    gender: Gender;
    themePrompt?: string | null;
    backgroundPrompt?: string | null;
    anglePrompt?: string | null;
}

/**
 * Constructs the final prompt string to send to Vertex AI based on the generation mode.
 */
export function constructVertexPrompt({
    mode,
    gender,
    themePrompt,
    backgroundPrompt,
    anglePrompt,
}: VertexPromptInputs): string {
    // Default fallbacks
    const theme = themePrompt || "Professional fashion photography style with elegant lighting and composition";
    const background = backgroundPrompt || "Clean, minimal studio background with soft neutral tones";
    const angle = anglePrompt || "Front-facing product shot with balanced composition";

    if (mode === 'social_media') {
        // Post Ready (Social Media)
        // "A single realistic fashion photograph of the model from the reference image wearing the same outfit. ${themePrompt}. The model is positioned ${backgroundPrompt}. The image should feel genuine and naturally captured, not overly edited or artificial."
        return `A single realistic fashion photograph of the model from the reference image wearing the same outfit. ${theme}. The model is positioned ${background}. The image should feel genuine and naturally captured, not overly edited or artificial.`;
    } else {
        // Shop Ready (Product Shots)
        // Step A (Combine Details)
        const details = `${background}. ${angle}`;

        // Step B (Wrap with Strict Instructions)
        const noun = gender === 'male' ? 'male' : 'female';
        const possessive = gender === 'male' ? 'his' : 'her';

        // "Using the ${noun} subject from the reference image, generate a new image that maintains ${possessive} exact pose (if the reference shows only the upper body, keep only the upper body visible), facial expression, body proportions, and camera angle. ${details}"
        return `Using the ${noun} subject from the reference image, generate a new image that maintains ${possessive} exact pose (if the reference shows only the upper body, keep only the upper body visible), facial expression, body proportions, and camera angle. ${details}`;
    }
}
