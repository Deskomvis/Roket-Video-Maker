/* tslint:disable */
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// This file contains all logic related to the User Interface.
// It initializes DOM elements and sets up all event listeners.
// By separating this from the main logic, we make the code cleaner
// and fix the "Failed to load" error by ensuring DOM elements are
// selected only after the page is fully loaded.

import { GoogleGenAI } from '@google/genai';
import * as state from './state';
import * as api from './api';

// --- DOM ELEMENTS (DECLARED HERE, INITIALIZED IN initializeUI) ---
let generatorSection: HTMLElement;
let generatorApp: HTMLElement;
let sidebarNav: HTMLElement;
let controlPanelTitle: HTMLElement;
let imageStudioPanel: HTMLElement;
let videoStoryboardPanel: HTMLElement;
let storyboardScenesContainer: HTMLElement;
let addSceneBtn: HTMLButtonElement;
let downloadAllButton: HTMLButtonElement;
let resultsContainer: HTMLElement;
let placeholder: HTMLElement;
let generateButton: HTMLButtonElement;
let globalStatusEl: HTMLElement;
let combineImagesPanel: HTMLElement;
let combinePromptInput: HTMLTextAreaElement;
let changeHairInput: HTMLInputElement;
let changeClothesInput: HTMLInputElement;
let combinePromptGroup: HTMLElement;
let storyboardPoseGroup: HTMLElement;
let advancedEditingSection: HTMLElement;
let imageStoryboardCustomGroup: HTMLElement;
let imageStoryboardScenesContainer: HTMLElement;
let addImageSceneBtn: HTMLButtonElement;
let singleModelUploadGroup: HTMLElement;


// Concurrency limits for parallel generation to avoid rate-limiting
const IMAGE_CONCURRENCY_LIMIT = 3;
const VIDEO_CONCURRENCY_LIMIT = 2;
const SUBTITLE_TEXT = 'Mass Accounts • Mass Content • Maximum Profit';

// --- UI HELPER FUNCTIONS ---

/**
 * Runs a set of promise-returning functions with a specified concurrency limit.
 * This prevents hitting API rate limits while speeding up generation.
 * @param tasks An array of functions, where each function returns a Promise.
 * @param limit The maximum number of tasks to run concurrently.
 */
async function runWithConcurrency(tasks: Array<() => Promise<any>>, limit: number): Promise<void> {
    const executing = new Set<Promise<any>>();
    for (const task of tasks) {
        const promise = task().finally(() => {
            executing.delete(promise);
        });
        executing.add(promise);
        if (executing.size >= limit) {
            await Promise.race(executing);
        }
    }
    await Promise.all(Array.from(executing));
}

function setLoadingState(element: HTMLElement, message: string) {
  element.classList.remove('loading');
  element.innerHTML = message;
  element.classList.add('loading');
}

function clearLoadingState(element: HTMLElement) {
  element.classList.remove('loading');
}

function clearOtherModeInputs(currentMode: string) {
    const allPanels = document.querySelectorAll<HTMLElement>('.control-panel > div[id$="-panel"]');
    allPanels.forEach(panel => {
        if (panel.id !== `${currentMode}-panel`) {
            const inputs = panel.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select');
            // FIX: Use `instanceof` to narrow the type of `input` before accessing properties
            // like `type` and `checked` which are not present on all element types (e.g., HTMLTextAreaElement).
            inputs.forEach(input => {
                if (input instanceof HTMLInputElement) {
                    if (input.type === 'checkbox' || input.type === 'radio') {
                        input.checked = false;
                    } else if (input.type !== 'button' && input.type !== 'submit') {
                        input.value = '';
                    }
                } else { // For HTMLTextAreaElement and HTMLSelectElement
                    input.value = '';
                }
            });
            panel.querySelectorAll<HTMLElement>('.image-upload-preview-container').forEach(p => p.classList.add('hidden'));
            panel.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach(i => i.value = '');
        }
    });

    // Reset global state variables for other modes
    if (currentMode !== 'image-studio' && currentMode !== 'image-storyboard') {
        state.setProductImageBase64('');
        state.setModelImageBase64('');
        state.setFaceImageBase64('');
    }
     if (currentMode !== 'image-storyboard') {
        state.resetImageStoryboard();
        if (imageStoryboardScenesContainer) imageStoryboardScenesContainer.innerHTML = '';
    }
    if (currentMode !== 'video-storyboard') {
        state.resetStoryboard();
        if (storyboardScenesContainer) storyboardScenesContainer.innerHTML = '';
    }
}

export function setupFileUpload(
    inputId: string,
    previewContainerId: string,
    previewImgId: string,
    removeBtnId: string,
    fileNameElId: string,
    onFileReady: (base64: string, file: File | null) => void,
) {
    const input = document.getElementById(inputId) as HTMLInputElement;
    const previewContainer = document.getElementById(previewContainerId) as HTMLElement;
    const previewImg = document.getElementById(previewImgId) as HTMLImageElement;
    const removeBtn = document.getElementById(removeBtnId) as HTMLButtonElement;
    const fileNameEl = document.getElementById(fileNameElId) as HTMLElement;
    
    if (!input || !previewContainer || !previewImg || !removeBtn) {
        console.error(`File upload setup failed for input: ${inputId}. One or more required DOM elements not found.`);
        return;
    }

    const originalFileNameText = fileNameEl?.textContent;

    input.addEventListener('change', async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
            const base64 = await state.fileToBase64(file);
            onFileReady(base64, file);
            previewImg.src = URL.createObjectURL(file);
            previewContainer.classList.remove('hidden');
            if (fileNameEl) fileNameEl.textContent = file.name;
        }
    });

    removeBtn.addEventListener('click', () => {
        input.value = '';
        previewContainer.classList.add('hidden');
        previewImg.src = '';
        if (fileNameEl) fileNameEl.textContent = originalFileNameText || 'Upload Image';
        onFileReady('', null); // Signal removal
    });
}

// --- API KEY MANAGEMENT (REMOVED) ---
// The application now assumes the API key is provided via environment variables.
// All UI and logic for manual key selection has been removed.

// --- GENERATION LOGIC WRAPPERS (CALLS CORE API FUNCTIONS AND UPDATES UI) ---

async function handleGenerateClick() {
    // API Key check is no longer needed as we assume it's always present.
    try {
        switch (state.activeMode) {
            case 'image-studio': await runImageStudioGeneration(); break;
            case 'image-storyboard': await generateImageStoryboard(); break;
            case 'video-storyboard': await runVideoStoryboardGeneration(); break;
        }
    } catch (error: any) {
        console.error("Generation failed:", error);
        globalStatusEl.innerHTML = `Error: ${error.message}`;
        generateButton.disabled = false; // Re-enable on failure
    }
}

async function runImageStudioGeneration() {
    await runCombineImagesGeneration();
}

async function runCombineImagesGeneration() {
    if (!state.productImageBase64 || !state.modelImageBase64) {
        globalStatusEl.textContent = 'Please upload both a product and a model image.';
        return;
    }
    let prompt = combinePromptInput.value.trim();
    if (!prompt) {
        globalStatusEl.textContent = 'Please enter a prompt.';
        return;
    }

    placeholder.classList.add('hidden');
    generateButton.disabled = true;
    globalStatusEl.textContent = 'Combining images...';
    resultsContainer.innerHTML = '';
    state.generatedAssetUrls.length = 0;

    const resultItem = document.createElement('div');
    resultItem.className = 'result-item status loading';
    resultItem.innerHTML = `<p>Generating combined image...</p>`;
    resultsContainer.prepend(resultItem);

    if (changeHairInput.value) prompt += ` The model should have ${changeHairInput.value}.`;
    if (changeClothesInput.value) prompt += ` The model should be wearing ${changeClothesInput.value}.`;
    if (state.faceImageBase64) prompt += ` The model's face should be replaced with the new face provided.`;

    const aspectRatio = document.querySelector('#combine-aspect-ratio-selector .tab-button.active')?.getAttribute('data-ratio') || '1:1';

    try {
        const result = await api.generateImageWithPrompt(prompt, aspectRatio, resultItem, state.modelImageBase64, state.productImageBase64);
        if (result) {
            state.generatedAssetUrls.push({ url: result.imageUrl, filename: result.filename });
             (resultItem as any).dataset.filename = result.filename;
            const aspectClass = `aspect-${aspectRatio.replace(':', '-')}`;
            resultItem.innerHTML = `
                <div class="image-container ${aspectClass}">
                    <img src="${result.imageUrl}" alt="Generated storyboard image">
                </div>
                <div class="card-actions">
                    <a href="${result.imageUrl}" download="${result.filename}" class="card-button">Download</a>
                    <button class="card-button regenerate-button" data-prompt="${encodeURIComponent(prompt)}" data-aspect-ratio="${aspectRatio}" data-model-base64="${state.modelImageBase64}" data-product-base64="${state.productImageBase64}">Regenerate</button>
                </div>`;
            clearLoadingState(resultItem);
            downloadAllButton.classList.remove('hidden');
        }
        globalStatusEl.textContent = 'Image combination complete!';
    } catch (error: any) {
        resultItem.innerHTML = `<p class="status-error">Error: ${error.message}</p><button class="card-button regenerate-button" data-prompt="${encodeURIComponent(prompt)}" data-aspect-ratio="${aspectRatio}" data-model-base64="${state.modelImageBase64}" data-product-base64="${state.productImageBase64}">Regenerate</button>`;
        clearLoadingState(resultItem);
        globalStatusEl.textContent = 'An error occurred during image combination.';
    }

    generateButton.disabled = false;
}

async function generateImageStoryboard() {
    const scenesToGenerate = state.imageStoryboardScenes.filter(scene => scene.prompt.trim() !== '');
    if (scenesToGenerate.length === 0) {
        globalStatusEl.textContent = 'Please add at least one scene with a prompt.';
        return;
    }
    if (!state.productImageBase64 || !state.modelImageBase64) {
        globalStatusEl.textContent = 'Please upload both product and model images.';
        return;
    }

    placeholder.classList.add('hidden');
    generateButton.disabled = true;
    resultsContainer.innerHTML = '';
    state.generatedAssetUrls.length = 0;
    globalStatusEl.textContent = `Queuing ${scenesToGenerate.length} storyboard scenes...`;

    const aspectRatio = document.querySelector('#combine-aspect-ratio-selector .tab-button.active')?.getAttribute('data-ratio') || '1:1';

    const tasks = scenesToGenerate.map((scene, i) => {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item status loading';
        resultItem.innerHTML = `<p>Waiting : Sabar Yaa!</p>`;
        resultsContainer.appendChild(resultItem);

        return async () => {
            resultItem.innerHTML = `<p>Generating Scene ${i + 1}...</p>`;
            try {
                const result = await api.retryWithBackoff(() => api.generateImageWithPrompt(scene.prompt, aspectRatio, resultItem, state.modelImageBase64, state.productImageBase64), 3, 2000, (attempt) => {
                    resultItem.innerHTML = `<p>Retrying Scene ${i + 1} (Attempt ${attempt + 1})...</p>`;
                });
                if (result) {
                    state.generatedAssetUrls.push({ url: result.imageUrl, filename: result.filename });
                    (resultItem as any).dataset.filename = result.filename;
                    const aspectClass = `aspect-${aspectRatio.replace(':', '-')}`;
                    resultItem.innerHTML = `
                        <div class="image-container ${aspectClass}">
                            <img src="${result.imageUrl}" alt="Generated storyboard image">
                        </div>
                        <div class="card-actions">
                            <a href="${result.imageUrl}" download="${result.filename}" class="card-button">Download</a>
                            <button class="card-button regenerate-button" data-prompt="${encodeURIComponent(scene.prompt)}" data-aspect-ratio="${aspectRatio}" data-model-base64="${state.modelImageBase64}" data-product-base64="${state.productImageBase64}">Regenerate</button>
                        </div>`;
                    clearLoadingState(resultItem);
                    downloadAllButton.classList.remove('hidden');
                }
            } catch (error: any) {
                resultItem.innerHTML = `<p class="status-error">Error: ${error.message}</p><button class="card-button regenerate-button" data-prompt="${encodeURIComponent(scene.prompt)}" data-aspect-ratio="${aspectRatio}" data-model-base64="${state.modelImageBase64}" data-product-base64="${state.productImageBase64}">Regenerate</button>`;
                clearLoadingState(resultItem);
            }
        };
    });

    await runWithConcurrency(tasks, IMAGE_CONCURRENCY_LIMIT);

    globalStatusEl.textContent = 'Storyboard generation complete!';
    generateButton.disabled = false;
}

async function runVideoStoryboardGeneration() {
    const scenesToGenerate = state.storyboardScenes.filter(sc => sc.file && sc.prompt);
    if (scenesToGenerate.length === 0) {
        globalStatusEl.textContent = 'Please add at least one scene image and ensure it has a prompt.';
        return;
    }

    generateButton.disabled = true;
    placeholder.classList.add('hidden');
    resultsContainer.innerHTML = '';
    state.generatedAssetUrls.length = 0;
    globalStatusEl.textContent = `Queuing ${scenesToGenerate.length} video scenes...`;

    const aspectRatio = document.querySelector(`#video-storyboard-aspect-ratio-selector .tab-button.active`)?.getAttribute('data-ratio') || '1:1';

    const tasks = scenesToGenerate.map((scene, i) => {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item status loading';
        resultItem.innerHTML = `<p>Waiting : Sabar Yaa!</p>`;
        resultsContainer.appendChild(resultItem);

        return async () => {
            resultItem.innerHTML = `<p>Generating video for Scene ${i + 1}...</p>`;
            try {
                const result = await api.generateVideoForScene(scene, scene.prompt, resultItem, aspectRatio);

                if (result) {
                    const aspectClass = aspectRatio === '1:1' ? 'aspect-1-1' : 'aspect-9-16';
                    resultItem.innerHTML = `
                        <div class="video-container ${aspectClass}">
                            <video src="${result.videoUrl}" controls loop autoplay muted></video>
                        </div>
                        <p class="card-prompt" style="font-size: 0.8rem; max-height: 50px; overflow-y: auto;">${scene.prompt}</p>
                        <div class="card-actions">
                            <a href="${result.videoUrl}" download="${result.filename}" class="card-button">Download</a>
                            <button class="card-button regenerate-video-button" data-scene-id="${scene.id}" data-aspect-ratio="${aspectRatio}" data-context="${state.activeMode}">Regenerate</button>
                        </div>`;
                    clearLoadingState(resultItem);
                    state.generatedAssetUrls.push({ url: result.videoUrl, filename: result.filename });
                    downloadAllButton.classList.remove('hidden');
                }
            } catch (error: any) {
                resultItem.innerHTML = `
                    <p class="status-error">${error.message}</p>
                    <div class="card-actions">
                        <button class="card-button regenerate-video-button" data-scene-id="${scene.id}" data-aspect-ratio="${aspectRatio}" data-context="${state.activeMode}">Regenerate</button>
                    </div>`;
                clearLoadingState(resultItem);
            }
        };
    });

    await runWithConcurrency(tasks, VIDEO_CONCURRENCY_LIMIT);

    globalStatusEl.textContent = 'Video storyboard generation complete!';
    generateButton.disabled = false;
}


// --- EVENT LISTENERS ---

function setupStoryboardEventListeners(container: HTMLElement, addBtn: HTMLButtonElement) {
    addBtn.addEventListener('click', () => {
        const sceneId = state.getNextSceneId();
        state.addStoryboardScene({ id: sceneId, file: null, base64: null, mimeType: null, prompt: '' });
        const slot = document.createElement('div');
        slot.className = 'scene-upload-slot';
        slot.dataset.sceneId = sceneId.toString();
        slot.innerHTML = `
            <div class="scene-header">
                <span class="scene-number">${state.storyboardScenes.length}</span>
                <div class="scene-file-info">
                    <img src="" alt="Scene preview" class="scene-preview hidden">
                    <label for="scene-input-${sceneId}" class="scene-upload-label">Click to upload image</label>
                    <input type="file" id="scene-input-${sceneId}" accept="image/*" class="sr-only">
                </div>
                <button class="scene-remove-btn" aria-label="Remove scene">&times;</button>
            </div>
            <div class="scene-prompt-container">
                <label for="scene-prompt-${sceneId}">Motion Prompt</label>
                <textarea id="scene-prompt-${sceneId}" class="scene-prompt-textarea" rows="4" placeholder="Describe the motion for this scene..."></textarea>
            </div>`;
        container.appendChild(slot);
    });

    container.addEventListener('click', (e: Event) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('scene-remove-btn')) {
            const slot = target.closest('.scene-upload-slot') as HTMLElement;
            if (slot && slot.dataset.sceneId) {
                const sceneId = parseInt(slot.dataset.sceneId, 10);
                state.removeStoryboardScene(sceneId);
                slot.remove();
                container.querySelectorAll('.scene-upload-slot .scene-number').forEach((num, index) => {
                    num.textContent = (index + 1).toString();
                });
            }
        }
    });

    container.addEventListener('change', async (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (target.type === 'file') {
            const file = target.files?.[0];
            const slot = target.closest('.scene-upload-slot') as HTMLElement;
            if (file && slot && slot.dataset.sceneId) {
                const sceneId = parseInt(slot.dataset.sceneId, 10);
                const label = slot.querySelector('.scene-upload-label') as HTMLElement;
                const preview = slot.querySelector('.scene-preview') as HTMLImageElement;
                label.textContent = 'Loading...';
                
                const base64 = await state.fileToBase64(file);
                state.updateStoryboardScene(sceneId, { file, base64, mimeType: file.type });
                
                preview.src = URL.createObjectURL(file);
                preview.classList.remove('hidden');
                label.textContent = file.name;
            }
        }
    });

    container.addEventListener('input', (e: Event) => {
        const target = e.target as HTMLTextAreaElement;
        if (target.classList.contains('scene-prompt-textarea')) {
            const slot = target.closest('.scene-upload-slot') as HTMLElement;
            if (slot && slot.dataset.sceneId) {
                const sceneId = parseInt(slot.dataset.sceneId, 10);
                state.updateStoryboardScene(sceneId, { prompt: target.value });
            }
        }
    });
}

function setupEventListeners() {
    sidebarNav.addEventListener('click', (e: Event) => {
        const button = (e.target as HTMLElement).closest('.sidebar-menu-button');
        if (!button) return;

        sidebarNav.querySelectorAll('.sidebar-menu-button').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        const mode = button.getAttribute('data-mode') as any;
        state.setActiveMode(mode);
        
        let titleText = button.querySelector('span')?.textContent || 'Control Panel';
        controlPanelTitle.textContent = titleText;


        document.querySelectorAll<HTMLElement>('.control-panel > div[id$="-panel"]').forEach(p => p.classList.add('hidden'));
        
        const activePanel = document.querySelector<HTMLElement>(`#${state.activeMode}-panel`);
        if (activePanel) {
            activePanel.classList.remove('hidden');
        } else if (state.activeMode === 'image-studio' || state.activeMode === 'image-storyboard') {
            imageStudioPanel.classList.remove('hidden');
        }
        
        const isStoryboard = state.activeMode === 'image-storyboard';
        
        combinePromptGroup.classList.toggle('hidden', isStoryboard);
        storyboardPoseGroup.classList.toggle('hidden', true);
        imageStoryboardCustomGroup.classList.toggle('hidden', !isStoryboard);
        advancedEditingSection.classList.toggle('hidden', isStoryboard);
        singleModelUploadGroup.classList.toggle('hidden', false); // Always visible in combine mode now


        if (isStoryboard) {
            combineImagesPanel.classList.remove('hidden');
        }

        clearOtherModeInputs(state.activeMode);
        resultsContainer.innerHTML = '';
        if (placeholder) {
            resultsContainer.appendChild(placeholder);
            placeholder.classList.remove('hidden');
            placeholder.querySelector('p')!.textContent = 'Your generated assets will appear here.';
        }
        state.generatedAssetUrls.length = 0;
        downloadAllButton.classList.add('hidden');
    });

    generateButton.addEventListener('click', handleGenerateClick);
    
    // File Uploads
    setupFileUpload('product-image-input', 'product-image-preview-container', 'product-image-preview', 'remove-product-image-button', 'product-file-name', (base64) => state.setProductImageBase64(base64));
    setupFileUpload('model-image-input', 'model-image-preview-container', 'model-image-preview', 'remove-model-image-button', 'model-file-name', (base64) => state.setModelImageBase64(base64));
    setupFileUpload('face-image-input', 'face-image-preview-container', 'face-image-preview', 'remove-face-image-button', 'face-file-name', (base64) => state.setFaceImageBase64(base64));
    
    // Tab container handler
    document.querySelectorAll<HTMLElement>('.tabs-container').forEach(container => {
        container.addEventListener('click', (e: Event) => {
            const clickedButton = (e.target as HTMLElement).closest('.tab-button');
            if (clickedButton) {
                container.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
                clickedButton.classList.add('active');
            }
        });
    });

    // Event Delegation for dynamic buttons in results container
    resultsContainer.addEventListener('click', async (e: Event) => {
        const target = e.target as HTMLElement;
        const regenerateBtn = target.closest('.regenerate-button');
        const regenerateVideoBtn = target.closest('.regenerate-video-button');
        const regenerateSingleImageBtn = target.closest('.regenerate-single-image-button');
        
        if (target.closest('.download-image-button')) {
            // This is now an <a> tag, so default browser behavior handles the download.
            // No JS needed.
            return;
        }

        if (regenerateBtn) {
            const resultItem = regenerateBtn.closest('.result-item') as HTMLElement;
            if (!resultItem) return;

            const prompt = decodeURIComponent(regenerateBtn.getAttribute('data-prompt')!);
            const aspectRatio = regenerateBtn.getAttribute('data-aspect-ratio')!;
            const modelBase64 = regenerateBtn.getAttribute('data-model-base64')!;
            const productBase64 = regenerateBtn.getAttribute('data-product-base64');
            
            setLoadingState(resultItem, '<p>Regenerating...</p>');
            
            try {
                const result = await api.retryWithBackoff(() => api.generateImageWithPrompt(prompt, aspectRatio, resultItem, modelBase64, productBase64), 3, 2000, (attempt) => {
                    resultItem.innerHTML = `<p>Regeneration failed. Retrying... (Attempt ${attempt + 1})</p>`;
                });
                if (result) {
                    state.generatedAssetUrls.push({ url: result.imageUrl, filename: result.filename });
                    (resultItem as any).dataset.filename = result.filename;
                    const aspectClass = `aspect-${aspectRatio.replace(':', '-')}`;
                    let cardContent = `
                        <div class="image-container ${aspectClass}">
                            <img src="${result.imageUrl}" alt="Generated storyboard image">
                        </div>
                        <div class="card-actions">
                            <a href="${result.imageUrl}" download="${result.filename}" class="card-button">Download</a>
                            <button class="card-button regenerate-button" data-prompt="${encodeURIComponent(prompt)}" data-aspect-ratio="${aspectRatio}" data-model-base64="${modelBase64}" ${productBase64 ? `data-product-base64="${productBase64}"` : ''}>Regenerate</button>
                        </div>`;
                    resultItem.innerHTML = cardContent;
                    clearLoadingState(resultItem);
                }
            } catch (error: any) {
                 resultItem.innerHTML = `<p class="status-error">Failed to regenerate: ${error.message}</p>`;
                 clearLoadingState(resultItem);
            }
        } else if (regenerateVideoBtn) {
            const resultItem = regenerateVideoBtn.closest('.result-item') as HTMLElement;
            const sceneIdStr = (regenerateVideoBtn.closest('[data-scene-id]') as HTMLElement)?.dataset.sceneId;
            if (!resultItem || !sceneIdStr) return;
            const sceneId = parseInt(sceneIdStr, 10);
            const scene = state.storyboardScenes.find(sc => sc.id === sceneId);
            
            if (!scene) return;

            const prompt = scene.prompt;
            const aspectRatio = regenerateVideoBtn.getAttribute('data-aspect-ratio')!;
            const context = regenerateVideoBtn.getAttribute('data-context');
            
            setLoadingState(resultItem, `<p>Regenerating video for Scene ${scene.id}...</p>`);
            
            try {
                const result = await api.generateVideoForScene(scene, prompt, resultItem, aspectRatio);
                if (result) {
                    const aspectClass = aspectRatio === '1:1' ? 'aspect-1-1' : 'aspect-9-16';
                    resultItem.innerHTML = `
                        <div class="video-container ${aspectClass}">
                            <video src="${result.videoUrl}" controls loop autoplay muted></video>
                        </div>
                        <p class="card-prompt" style="font-size: 0.8rem; max-height: 50px; overflow-y: auto;">${prompt}</p>
                        <div class="card-actions">
                            <a href="${result.videoUrl}" download="${result.filename}" class="card-button">Download</a>
                            <button class="card-button regenerate-video-button" data-scene-id="${scene.id}" data-aspect-ratio="${aspectRatio}" data-context="${context || 'video-storyboard'}">Regenerate</button>
                        </div>`;
                    clearLoadingState(resultItem);
                    state.generatedAssetUrls.push({ url: result.videoUrl, filename: result.filename });
                }
            } catch (error: any) {
                 resultItem.innerHTML = `
                    <p class="status-error">${error.message}</p>
                    <div class="card-actions">
                        <button class="card-button regenerate-video-button" data-scene-id="${scene.id}" data-aspect-ratio="${aspectRatio}" data-context="${context || 'video-storyboard'}">Regenerate</button>
                    </div>`;
                clearLoadingState(resultItem);
            }

        } else if (regenerateSingleImageBtn) {
            const resultItem = regenerateSingleImageBtn.closest('.result-item') as HTMLElement;
            if (!resultItem) return;

            const prompt = decodeURIComponent(regenerateSingleImageBtn.getAttribute('data-prompt')!);
            const aspectRatio = regenerateSingleImageBtn.getAttribute('data-aspect-ratio')!;
            const hasReference = regenerateSingleImageBtn.getAttribute('data-reference-image') === 'true';
            const context = regenerateSingleImageBtn.getAttribute('data-context');

            let referenceImages: string[] = [];
            
            setLoadingState(resultItem, `<p>Regenerating...</p>`);
            
            try {
                const result = await api.generateSingleImage(prompt, aspectRatio, referenceImages);
                if (result) {
                    state.generatedAssetUrls.push({ url: result.imageUrl, filename: result.filename });
                    const aspectClass = `aspect-${aspectRatio.replace(':', '-')}`;
                    let cardContent = `
                        <div class="image-container ${aspectClass}">
                            <img src="${result.imageUrl}" alt="Generated image">
                        </div>`;
        
                    cardContent += `
                        <div class="card-actions">
                            <a href="${result.imageUrl}" download="${result.filename}" class="card-button">Download</a>
                            <button class="card-button regenerate-single-image-button" 
                                    data-prompt="${encodeURIComponent(prompt)}" 
                                    data-aspect-ratio="${aspectRatio}" 
                                    data-reference-image="${hasReference ? 'true' : 'false'}"
                                    data-context="${context}">
                                Regenerate
                            </button>
                        </div>`;
                    resultItem.innerHTML = cardContent;
                    clearLoadingState(resultItem);
                }
            } catch (error: any) {
                resultItem.innerHTML = `<p class="status-error">${error.message}</p>
                    <div class="card-actions">
                        <button class="card-button regenerate-single-image-button" 
                                data-prompt="${encodeURIComponent(prompt)}" 
                                data-aspect-ratio="${aspectRatio}"
                                data-reference-image="${hasReference ? 'true' : 'false'}"
                                data-context="${context}">
                            Regenerate
                        </button>
                    </div>`;
                clearLoadingState(resultItem);
            }
        }
    });

    downloadAllButton.addEventListener('click', async () => {
        const originalText = downloadAllButton.innerHTML;
        downloadAllButton.disabled = true;
        downloadAllButton.innerHTML = 'Downloading...';
    
        const assets = state.generatedAssetUrls;
        for (let i = 0; i < assets.length; i++) {
            const asset = assets[i];
            globalStatusEl.textContent = `Downloading ${i + 1} of ${assets.length}...`;
            
            const a = document.createElement('a');
            a.href = asset.url;
            a.download = asset.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
    
            // Small delay between downloads to prevent browser issues
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    
        downloadAllButton.disabled = false;
        downloadAllButton.innerHTML = originalText;
        globalStatusEl.textContent = 'All downloads complete.';
    });

    addImageSceneBtn.addEventListener('click', () => {
        const sceneId = state.getNextImageSceneId();
        const newScene = { id: sceneId, prompt: '' };
        state.addImageStoryboardScene(newScene);

        const slot = document.createElement('div');
        slot.className = 'scene-upload-slot';
        slot.dataset.sceneId = sceneId.toString();
        slot.innerHTML = `
            <div class="scene-prompt-container">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-xs);">
                    <label for="image-scene-prompt-${sceneId}" class="scene-title-label" style="font-weight: 600; color: var(--text-secondary);">Scene ${state.imageStoryboardScenes.length}</label>
                    <button class="scene-remove-btn" style="position: static; transform: none;" aria-label="Remove scene">&times;</button>
                </div>
                <textarea id="image-scene-prompt-${sceneId}" class="scene-prompt-textarea" rows="4" placeholder="e.g., Model holding the product happily..."></textarea>
            </div>`;
        imageStoryboardScenesContainer.appendChild(slot);
    });

    imageStoryboardScenesContainer.addEventListener('click', (e: Event) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('scene-remove-btn')) {
            const slot = target.closest('.scene-upload-slot') as HTMLElement;
            if (slot && slot.dataset.sceneId) {
                const sceneId = parseInt(slot.dataset.sceneId, 10);
                state.removeImageStoryboardScene(sceneId);
                slot.remove();
                document.querySelectorAll('#image-storyboard-scenes-container .scene-upload-slot').forEach((sl, index) => {
                    const label = sl.querySelector('.scene-title-label');
                    if(label) label.textContent = `Scene ${index + 1}`;
                });
            }
        }
    });

    imageStoryboardScenesContainer.addEventListener('input', (e: Event) => {
        const target = e.target as HTMLTextAreaElement;
        if (target.classList.contains('scene-prompt-textarea')) {
            const slot = target.closest('.scene-upload-slot') as HTMLElement;
            if (slot && slot.dataset.sceneId) {
                const sceneId = parseInt(slot.dataset.sceneId, 10);
                state.updateImageStoryboardScenePrompt(sceneId, target.value);
            }
        }
    });

    setupStoryboardEventListeners(storyboardScenesContainer, addSceneBtn);
}

// --- INITIALIZATION ---

export function initializeUI() {
  // Make the concurrency helper available globally for other modules.
  (window as any).runWithConcurrency = runWithConcurrency;
  
  // Select all DOM elements safely after the DOM is loaded
  generatorSection = document.querySelector('#generator-section')!;
  generatorApp = document.querySelector('.generator-app')!;
  sidebarNav = document.querySelector('#sidebar-nav')!;
  controlPanelTitle = document.querySelector('#control-panel-title')!;
  imageStudioPanel = document.querySelector('#image-studio-panel')!;
  videoStoryboardPanel = document.querySelector('#video-storyboard-panel')!;
  storyboardScenesContainer = document.querySelector('#video-storyboard-panel #storyboard-scenes-container')!;
  addSceneBtn = document.querySelector('#add-scene-btn')!;
  downloadAllButton = document.querySelector('#download-all-button')!;
  resultsContainer = document.querySelector('#results-container')!;
  placeholder = resultsContainer.querySelector('.placeholder')!;
  generateButton = document.querySelector('#generate-button')!;
  globalStatusEl = document.querySelector('#global-status')!;
  combineImagesPanel = document.querySelector('#combine-images-panel')!;
  combinePromptInput = document.querySelector('#combine-prompt-input')!;
  changeHairInput = document.querySelector('#change-hair-input')!;
  changeClothesInput = document.querySelector('#change-clothes-input')!;
  combinePromptGroup = document.querySelector('#combine-prompt-group')!;
  storyboardPoseGroup = document.querySelector('#storyboard-pose-group')!;
  advancedEditingSection = document.querySelector('.advanced-editing-section')!;
  imageStoryboardCustomGroup = document.querySelector('#image-storyboard-custom-group')!;
  imageStoryboardScenesContainer = document.querySelector('#image-storyboard-scenes-container')!;
  addImageSceneBtn = document.querySelector('#add-image-scene-btn')!;
  singleModelUploadGroup = document.querySelector('#single-model-upload-group')!;

  
  // Attach all event listeners
  setupEventListeners();

  // API key is no longer checked on load. The app starts directly.
}