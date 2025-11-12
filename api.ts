/* tslint:disable */
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// This file contains all functions that interact with the GoogleGenAI API.
// Keeping them separate improves organization and modularity.

import {
  GoogleGenAI,
  Modality,
  Type,
} from '@google/genai';
import * as state from './state';

export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    retries = 3,
    delay = 1000,
    onRetry?: (attempt: number, error: any, delay: number) => void
): Promise<T> {
    let attempt = 1;
    while (attempt <= retries) {
        try {
            return await fn();
        } catch (error) {
            if (attempt === retries) {
                throw error;
            }
            if (onRetry) {
                onRetry(attempt, error, delay);
            }
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff
            attempt++;
        }
    }
    throw new Error("Max retries reached"); // Should not be reached
}

// FIX: Add function to get product description from an image for Product Studio.
export async function getProductDescription(base64Image: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = 'Please identify and describe the main product in this image. Provide a short, simple description suitable for use as a placeholder like "[product]" in another prompt. For example, if the image shows a bottle of lotion, a good description would be "a white bottle of lotion". Just return the description, no preamble.';
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/png', data: base64Image } },
                    { text: prompt }
                ]
            }
        });
        return response.text.trim();
    } catch (error: any) {
        console.error('Error getting product description:', error);
        throw new Error('Could not identify the product in the image.');
    }
}

export async function generateImageWithPrompt(prompt: string, aspectRatio: string, outputSlot: HTMLElement, currentModelBase64: string, productImageBase64?: string | null, retryCount = 0): Promise<{imageUrl: string, filename: string} | null> {
    const MAX_RETRIES = 1;
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const parts: any[] = [];
    const productImg = productImageBase64 !== undefined ? productImageBase64 : state.productImageBase64;

    if (productImg) {
        parts.push({ inlineData: { mimeType: 'image/png', data: productImg } });
    }
    if (currentModelBase64) {
        parts.push({ inlineData: { mimeType: 'image/png', data: currentModelBase64 } });
    }
    if (state.faceImageBase64 && state.activeMode === 'image-studio') {
        parts.push({ inlineData: { mimeType: 'image/png', data: state.faceImageBase64 } });
    }
    
    // Suggest the composition rather than forcing a file ratio.
    const enhancedPrompt = `The composition of the final image should be suitable for a ${aspectRatio} aspect ratio. ${prompt}`;
    parts.push({ text: enhancedPrompt });

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts },
            config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
        });
        
        if (!response.candidates || response.candidates.length === 0) {
            const errorMessage = response.text || 'No valid candidates returned from API. The prompt may have been blocked.';
            throw new Error(errorMessage);
        }

        const imagePart = response.candidates[0].content.parts.find(part => part.inlineData);
        const textPart = response.candidates[0].content.parts.find(part => part.text);

        if (imagePart && imagePart.inlineData) {
            const base64Image = imagePart.inlineData.data;
            const imageUrl = `data:image/png;base64,${base64Image}`;
            const filename = `generated-image-${Date.now()}.png`;
            return { imageUrl, filename };
        } else if (textPart && retryCount < MAX_RETRIES) {
             console.warn(`Model returned text instead of image. Retrying... Attempt ${retryCount + 1}`);
             outputSlot.innerHTML = `<p>Model returned text. Modifying prompt and retrying...</p>`;
             const modifiedPrompt = prompt + "\n\n(Catatan untuk AI: Pastikan outputnya adalah gambar, bukan teks.)";
             await new Promise(resolve => setTimeout(resolve, 1000));
             return await generateImageWithPrompt(modifiedPrompt, aspectRatio, outputSlot, currentModelBase64, productImageBase64, retryCount + 1);
        } else {
            const errorMessage = textPart?.text || 'No image generated. The prompt might have been blocked.';
            throw new Error(errorMessage);
        }
    } catch (error: any) {
        console.error('Error generating image:', error);
        let errorMessage = 'An error occurred during image generation.';
        const errorString = JSON.stringify(error);
        if (errorString.includes('quota exceeded') || errorString.includes('RESOURCE_EXHAUSTED')) {
            errorMessage = 'Image generation failed: API quota exceeded. Please check your account limits.';
        } else if (error.message) {
            errorMessage = `Error: ${error.message}`;
        }
        throw new Error(errorMessage);
    }
}

export async function generateSingleImage(prompt: string, aspectRatio: string, referenceImagesBase64: string[], retryCount = 0): Promise<{imageUrl: string, filename: string} | null> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const filename = `generated-image-${Date.now()}.png`;

    // --- IMAGE EDITING LOGIC (NANO BANANA) ---
    // This is the path for tasks like Product Studio, Pose Changer, etc.
    // where an input image exists and we need a different aspect ratio output.
    if (referenceImagesBase64 && referenceImagesBase64.length > 0) {
        const MAX_RETRIES = 1;
        const parts: any[] = [];
        
        referenceImagesBase64.forEach(base64 => {
            parts.push({ inlineData: { mimeType: 'image/png', data: base64 } });
        });
        
        // This is the NEW, more robust prompt to force out-painting.
        const outpaintingPrompt = `
Using the provided reference image(s) as the main subject, generate a new, complete, and photorealistic image that fills a **${aspectRatio} aspect ratio frame**.

**Crucially, you must extend the background and environment from the original image to fill the entire frame. Do NOT simply place the original image on a solid color background or create pillarbox/letterbox effects (white or black bars).**

The final output should look like a single, cohesive photograph taken natively in a ${aspectRatio} format.

Apply the following creative direction:
${prompt}
`;
        parts.push({ text: outpaintingPrompt });

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts },
                config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
            });

            if (!response.candidates || response.candidates.length === 0) {
                const errorMessage = response.text || 'No valid candidates from API. Prompt may be blocked.';
                throw new Error(errorMessage);
            }

            const imagePart = response.candidates[0].content.parts.find(part => part.inlineData);
            const textPart = response.candidates[0].content.parts.find(part => part.text);

            if (imagePart && imagePart.inlineData) {
                const base64Image = imagePart.inlineData.data;
                const imageUrl = `data:image/png;base64,${base64Image}`;
                return { imageUrl, filename };
            } else if (textPart && retryCount < MAX_RETRIES) {
                console.warn(`Model returned text. Retrying... Attempt ${retryCount + 1}`);
                const modifiedPrompt = prompt + "\n\n(AI note: Output must be an image, not text.)";
                await new Promise(resolve => setTimeout(resolve, 1000));
                return await generateSingleImage(modifiedPrompt, aspectRatio, referenceImagesBase64, retryCount + 1);
            } else {
                const errorMessage = textPart?.text || 'No image generated. Prompt may be blocked.';
                throw new Error(errorMessage);
            }
        } catch (error: any) {
            console.error('Error in generateSingleImage (editing):', error);
            throw new Error(error.message || 'An error occurred during image editing.');
        }
    } 
    // --- IMAGE GENERATION LOGIC (IMAGEN 4.0) ---
    // This is for text-to-image only, where no input image is provided.
    // This model natively supports aspect ratios, guaranteeing correct file dimensions.
    else {
        try {
            const response = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: prompt,
                config: {
                    numberOfImages: 1,
                    outputMimeType: 'image/png',
                    aspectRatio: aspectRatio as any, // This is the key for native aspect ratio support
                },
            });

            if (!response.generatedImages || response.generatedImages.length === 0 || !response.generatedImages[0].image) {
                 throw new Error("Image generation returned no results. The prompt may have been blocked by safety policies.");
            }

            const base64Image = response.generatedImages[0].image.imageBytes;
            const imageUrl = `data:image/png;base64,${base64Image}`;
            return { imageUrl, filename };
        } catch (error: any) {
            console.error('Error in generateSingleImage (generation):', error);
            throw new Error(error.message || 'An error occurred during image generation.');
        }
    }
}

export async function generateVideoForScene(scene: any, prompt: string, resultItem: HTMLElement, aspectRatio: string) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        let operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            image: { imageBytes: scene.base64, mimeType: scene.mimeType },
            config: { numberOfVideos: 1, aspectRatio: aspectRatio as any }
        });

        const progressMessages = [
            "Contacting the video generation servers...",
            "Warming up the AI model...",
            "Analyzing the scene and prompt...",
            "Rendering video frames...",
            "Almost there, finalizing the video..."
        ];
        let messageIndex = 0;
        
        while (!operation.done) {
            resultItem.innerHTML = `<p>${progressMessages[messageIndex % progressMessages.length]} (This may take a few minutes)</p>`;
            messageIndex++;
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await ai.operations.getVideosOperation({ operation: operation });
        }

        if (operation.response?.generatedVideos?.[0]?.video?.uri) {
            const downloadLink = operation.response.generatedVideos[0].video.uri;
            const apiKey = process.env.API_KEY;
            if (!apiKey) throw new Error("API Key not found for fetching video.");
            const videoResponse = await fetch(`${downloadLink}&key=${apiKey}`);
            const videoBlob = await videoResponse.blob();
            const videoUrl = URL.createObjectURL(videoBlob);
            const filename = `storyboard-scene-${scene.id}-${Date.now()}.mp4`;
            
            return { videoUrl, filename };

        } else {
            // Check for specific errors in the operation if available
            const error = (operation as any).error;
            if (error) {
                throw new Error(`Video generation failed: ${error.message || 'Unknown error'}`);
            }
            throw new Error("Video generation finished but no video URI was returned.");
        }
    } catch (error: any) {
        console.error(`Error generating video for scene ${scene.id}:`, error);
        const errorString = JSON.stringify(error);
        
        if (errorString.includes('Requested entity was not found')) {
            const userMessage = 'The configured API key is invalid or missing required permissions (e.g., billing not enabled). Please check the environment configuration.';
            throw new Error(`${userMessage} <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" style="color: var(--accent-bright); text-decoration: underline;">Learn more about billing.</a>`);
        }

        let errorMessage = `Failed to generate video for Scene ${scene.id}.`;
        if (errorString.includes('quota exceeded') || errorString.includes('RESOURCE_EXHAUSTED')) {
            errorMessage = `Video generation failed for Scene ${scene.id}: API quota has been exceeded. Please check your Google project billing or usage limits.`;
        } else if (error.message) {
            errorMessage = `Error for Scene ${scene.id}: ${error.message}`;
        }
        throw new Error(errorMessage);
    }
}

// FIX: Add function to generate audio from text for the Voice Over feature.
export async function generateAudioFromText(script: string, voiceName: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: script }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voiceName },
                    },
                },
            },
        });
        
        const audioPart = response.candidates?.[0]?.content?.parts?.[0];
        if (audioPart && audioPart.inlineData) {
            return audioPart.inlineData.data;
        } else {
            throw new Error("Audio generation failed: No audio data was returned from the API.");
        }
    } catch (error: any) {
        console.error(`Error generating audio for voice "${voiceName}":`, error);
        let errorMessage = `Failed to generate audio.`;
        const errorString = JSON.stringify(error);
        if (errorString.includes('quota exceeded') || errorString.includes('RESOURCE_EXHAUSTED')) {
            errorMessage = `Audio generation failed: API quota has been exceeded.`;
        } else if (error.message) {
            errorMessage = `Error: ${error.message}`;
        }
        throw new Error(errorMessage);
    }
}