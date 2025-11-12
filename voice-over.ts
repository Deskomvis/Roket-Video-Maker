/* tslint:disable */
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// This file contains all logic for the new "Studio Voice Over" feature.
// It uses the Gemini API for high-quality text-to-speech synthesis.

import * as state from './state';
import * as api from './api';

// --- CONSTANTS ---

// This function must be defined in ui.ts, so we're declaring it here to satisfy TypeScript.
declare function runWithConcurrency(tasks: Array<() => Promise<any>>, limit: number): Promise<void>;
const AUDIO_CONCURRENCY_LIMIT = 3;

const ACTORS = [
    { name: 'Zephyr', gender: 'male' },
    { name: 'Puck', gender: 'male' },
    { name: 'Charon', gender: 'male' },
    { name: 'Fenrir', gender: 'male' },
    { name: 'Kore', gender: 'female' },
];

// --- DOM ELEMENTS ---
let inputModeToggle: HTMLElement;
let scriptTextarea: HTMLTextAreaElement;
let modeInfo: HTMLElement;
let actorFilters: HTMLElement;
let actorGrid: HTMLElement;
let resultsContainer: HTMLElement;
let placeholder: HTMLElement;
let generateButton: HTMLButtonElement;
let globalStatusEl: HTMLElement;
let downloadAllButton: HTMLButtonElement;

// --- CORE FUNCTIONS ---

/**
 * Populates the actor grid with selectable actor cards.
 */
function populateActors() {
    actorGrid.innerHTML = '';
    const currentFilter = (actorFilters.querySelector('.tab-button.active') as HTMLElement)?.dataset.filter || 'all';

    const filteredActors = ACTORS.filter(actor =>
        currentFilter === 'all' || actor.gender === currentFilter
    );

    filteredActors.forEach(actor => {
        const card = document.createElement('div');
        card.className = 'actor-card';
        card.dataset.actorName = actor.name;
        if (actor.name === state.voiceOverSelectedActor) {
            card.classList.add('active');
        }

        card.innerHTML = `
            <div class="actor-header">
              <span class="actor-name">${actor.name}</span>
              <span class="gender-tag ${actor.gender}">${actor.gender === 'male' ? 'Pria' : 'Wanita'}</span>
            </div>
        `;
        actorGrid.appendChild(card);
    });
}

/**
 * Handles the main generation logic for voice overs.
 */
export async function runVoiceOverGeneration() {
    const script = scriptTextarea.value.trim();
    if (!script) {
        globalStatusEl.textContent = 'Please enter a script.';
        return;
    }
    state.setVoiceOverScript(script);

    const scriptsToProcess = state.voiceOverInputMode === 'mass'
        ? script.split('\n').filter(line => line.trim() !== '')
        : [script];

    if (scriptsToProcess.length === 0) {
        globalStatusEl.textContent = 'Please enter at least one line of script.';
        return;
    }

    generateButton.disabled = true;
    globalStatusEl.textContent = `Queuing ${scriptsToProcess.length} audio generations...`;
    placeholder.classList.add('hidden');
    resultsContainer.innerHTML = '';
    state.generatedAssetUrls.length = 0;
    downloadAllButton.classList.add('hidden');

    const tasks = scriptsToProcess.map((currentScript, i) => {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item audio-result-card status loading';
        resultItem.innerHTML = `<p>Waiting : Sabar Yaa!</p>`;
        resultsContainer.appendChild(resultItem);

        return async () => {
            resultItem.innerHTML = `<p>Generating audio for script ${i + 1}...</p>`;
            try {
                const base64Audio = await api.generateAudioFromText(currentScript, state.voiceOverSelectedActor);
                // Assuming the API returns a standard audio format like MP3. 'audio/mpeg' is a safe MIME type.
                const audioSrc = `data:audio/mpeg;base64,${base64Audio}`;
                const filename = `voice-over-${state.voiceOverSelectedActor}-${i + 1}.mp3`;
                
                state.generatedAssetUrls.push({ url: audioSrc, filename });
                
                resultItem.innerHTML = `
                    <p class="card-prompt">${currentScript}</p>
                    <audio controls src="${audioSrc}" style="width: 100%; margin-top: var(--space-xs);"></audio>
                    <div class="card-actions">
                        <a href="${audioSrc}" download="${filename}" class="card-button">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            Download
                        </a>
                    </div>
                `;
                resultItem.classList.remove('loading');
                downloadAllButton.classList.remove('hidden');

            } catch (error: any) {
                resultItem.innerHTML = `
                    <p class="card-prompt">${currentScript}</p>
                    <p class="status-error">Error: ${error.message}</p>`;
                resultItem.classList.remove('loading');
            }
        };
    });

    await (window as any).runWithConcurrency(tasks, AUDIO_CONCURRENCY_LIMIT);

    globalStatusEl.textContent = 'Voice over generation complete!';
    generateButton.disabled = false;
}

/**
 * Sets up all event listeners for the voice over panel.
 */
function setupEventListeners() {
    inputModeToggle.addEventListener('click', (e) => {
        const button = (e.target as HTMLElement).closest('.tab-button');
        if (button && (button as HTMLElement).dataset.mode) {
            const mode = (button as HTMLElement).dataset.mode as 'single' | 'mass';
            state.setVoiceOverInputMode(mode);
            modeInfo.style.display = mode === 'mass' ? 'block' : 'none';
        }
    });

    scriptTextarea.addEventListener('input', () => {
        state.setVoiceOverScript(scriptTextarea.value);
    });

    actorFilters.addEventListener('click', (e) => {
        const button = (e.target as HTMLElement).closest('.tab-button');
        if (button && (button as HTMLElement).dataset.filter) {
            populateActors();
        }
    });

    actorGrid.addEventListener('click', (e) => {
        const card = (e.target as HTMLElement).closest('.actor-card');
        if (!card) return;

        const actorName = (card as HTMLElement).dataset.actorName;
        if (!actorName) return;

        state.setVoiceOverSelectedActor(actorName);
        actorGrid.querySelectorAll('.actor-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
    });
}

/**
 * Initializes the entire voice over feature module.
 */
export function initializeVoiceOver() {
    // Select DOM elements
    inputModeToggle = document.querySelector('#voice-over-input-mode-toggle')!;
    scriptTextarea = document.querySelector('#voice-over-script-input')!;
    modeInfo = document.querySelector('#voice-over-mode-info')!;
    actorFilters = document.querySelector('#voice-over-actor-filters')!;
    actorGrid = document.querySelector('#voice-over-actor-grid')!;
    resultsContainer = document.querySelector('#results-container')!;
    placeholder = resultsContainer.querySelector('.placeholder')!;
    generateButton = document.querySelector('#generate-button')!;
    globalStatusEl = document.querySelector('#global-status')!;
    downloadAllButton = document.querySelector('#download-all-button')!;

    // Initial setup
    populateActors();
    setupEventListeners();
    modeInfo.style.display = 'none'; // Initially hidden
}