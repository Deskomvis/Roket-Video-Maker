/* tslint:disable */
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// This file contains all logic for the new "Product Studio" feature.
// It is self-contained to keep the codebase clean and modular.

import * as state from './state';
import * as api from './api';
import { setupFileUpload } from './ui';

// This function must be defined in ui.ts, so we're declaring it here to satisfy TypeScript.
declare function runWithConcurrency(tasks: Array<() => Promise<any>>, limit: number): Promise<void>;
const IMAGE_CONCURRENCY_LIMIT = 3;

const PRODUCT_STUDIO_VARIATIONS = [
    { name: 'Studio White Minimalist', prompts: [
        'Foto [produk] di latar belakang putih polos dengan pencahayaan softbox dari kiri-kanan, shadow lembut.',
        '[produk] difoto flat lay di atas background putih matte, cahaya natural studio.',
        '[produk] close-up dengan lighting tiga titik (key light, fill light, rim light), background putih seamless.',
        '[produk] ditempatkan di atas meja kaca reflektif, efek bayangan lembut ke bawah.',
        'Foto katalog [produk], high-resolution, tanpa properti tambahan, clean studio white.',
        '[produk] floating di udara dengan background putih terang, efek shadow di bawahnya.',
    ]},
    { name: 'Luxury Black Studio', prompts: [
        '[produk] di atas background hitam glossy dengan pencahayaan spotlight dramatis.',
        'Foto close-up [produk] dengan cahaya dari atas, menghasilkan efek kontras tinggi.',
        '[produk] berdiri di atas alas marmer hitam, background gelap dengan cahaya tipis di belakang.',
        'Foto [produk] dengan efek cahaya melingkar (halo light) dari belakang.',
        '[produk] difoto dengan refleksi kaca hitam di bawahnya, efek glossy elegan.',
        'Studio foto gaya luxury brand, background hitam pekat, produk jadi fokus utama.',
    ]},
    { name: 'Pastel Aesthetic', prompts: [
        'Foto [produk] di studio dengan background pastel pink lembut.',
        '[produk] diletakkan di podium putih dengan latar pastel biru.',
        '[produk] difoto flat lay di atas latar pastel hijau dengan pencahayaan lembut.',
        '[produk] floating di tengah latar pastel gradient (pink ke ungu).',
        '[produk] dengan bayangan soft pastel di background, gaya aesthetic feminin.',
        'Foto [produk] dengan latar pastel oranye lembut, gaya editorial modern.',
    ]},
    { name: 'Natural Organic', prompts: [
        '[produk] difoto dengan properti daun hijau tropis di sekitar, lighting studio lembut.',
        'Flat lay [produk] di atas alas kayu alami, pencahayaan natural.',
        '[produk] berdiri di podium batu putih dengan properti tanaman hijau kecil.',
        'Foto studio [produk] dengan latar dedaunan out of focus.',
        '[produk] difoto dengan cahaya matahari tiruan, efek natural morning light.',
        '[produk] diletakkan di atas kain linen krem, cahaya lembut dari samping.',
    ]},
    { name: 'Water Splash Effect', prompts: [
        '[produk] difoto dengan efek air splash membeku di belakang, studio style.',
        'Foto close-up [produk] dengan tetesan air di permukaan, pencahayaan dramatis.',
        '[produk] berdiri di atas permukaan air reflektif, background biru gelap.',
        'Foto [produk] dengan efek kabut tipis dan uap air, gaya fresh cooling.',
        '[produk] floating dengan cipratan air mengelilingi, frozen motion capture.',
        '[produk] difoto dalam studio kaca transparan dengan butiran air menempel.',
    ]},
    { name: 'Neon Light Futuristic', prompts: [
        '[produk] difoto dengan cahaya neon biru dan ungu, background gelap futuristik.',
        '[produk] diletakkan di podium akrilik transparan, lampu neon pink di belakang.',
        '[produk] close-up dengan refleksi neon hijau di sisi kanan.',
        '[produk] di dalam studio dengan grid lampu neon biru.',
        'Foto [produk] dengan efek cahaya cyberpunk, neon merah dan biru.',
        '[produk] floating di tengah cahaya neon lingkaran holografis.',
    ]},
    { name: 'Rustic Wood Warmth', prompts: [
        '[produk] diletakkan di meja kayu rustic dengan cahaya hangat.',
        'Flat lay [produk] di atas papan kayu tua, gaya vintage.',
        '[produk] dengan properti lilin menyala di background, lighting hangat.',
        'Foto close-up [produk] dengan tekstur kayu di belakang.',
        '[produk] difoto dengan cahaya kuning oranye seperti sunset.',
        '[produk] diletakkan di rak kayu klasik, suasana natural cozy.',
    ]},
    { name: 'Luxury Gold Premium', prompts: [
        '[produk] diletakkan di podium emas berkilau, background hitam elegan.',
        '[produk] dengan cahaya spotlight emas, efek glamor.',
        'Foto close-up [produk] dengan refleksi emas di permukaan.',
        '[produk] difoto dengan kain satin emas di sekelilingnya.',
        '[produk] floating di tengah partikel emas beterbangan.',
        'Studio foto [produk] dengan lighting warm gold high-end.',
    ]},
    { name: 'Gradient Modern', prompts: [
        '[produk] difoto di depan background gradient biru ke ungu.',
        'Flat lay [produk] dengan latar gradient pastel hijau ke kuning.',
        '[produk] floating dengan efek cahaya gradient oranye ke pink.',
        'Foto [produk] dengan lighting soft gradient keabu-abuan.',
        '[produk] diletakkan di podium kaca, background gradient biru muda.',
        '[produk] dengan latar gradient futuristik, gaya modern digital.',
    ]},
    { name: 'Desert Sand Vibe', prompts: [
        '[produk] diletakkan di atas pasir halus, background krem alami.',
        'Foto close-up [produk] dengan tekstur pasir di sekeliling.',
        '[produk] berdiri di podium batu pasir, lighting hangat seperti matahari gurun.',
        'Flat lay [produk] dengan properti kerikil kecil.',
        'Foto [produk] dengan cahaya golden hour, efek desert aesthetic.',
        '[produk] floating di atas pasir berkilau, bayangan lembut.',
    ]},
    { name: 'Crystal Glass Shine', prompts: [
        '[produk] dikelilingi pecahan kaca kristal, lighting dramatis.',
        'Foto close-up [produk] di atas permukaan kaca transparan.',
        '[produk] dengan background prisma kaca, menghasilkan cahaya spektrum.',
        '[produk] difoto dengan refleksi kaca ganda, efek artistik.',
        'Foto studio [produk] dengan properti kristal transparan.',
        '[produk] floating di tengah pecahan kaca artistik.',
    ]},
    { name: 'Smoke & Mystery', prompts: [
        '[produk] dikelilingi asap tipis putih, lighting dramatis.',
        '[produk] dengan asap warna biru ungu, gaya futuristik.',
        'Foto close-up [produk] dengan asap swirl di background.',
        '[produk] di podium hitam dengan efek kabut tebal di bawah.',
        'Studio foto [produk] dengan lighting kontras dan asap merah.',
        '[produk] floating di tengah kabut misterius.',
    ]},
    { name: 'Ice & Cool Fresh', prompts: [
        '[produk] difoto dengan properti es batu di sekelilingnya.',
        '[produk] berdiri di podium kaca beku dengan efek embun.',
        'Foto close-up [produk] dengan tetesan air dingin di permukaan.',
        '[produk] di studio dengan background biru es.',
        '[produk] floating dengan serpihan es membeku di sekeliling.',
        'Foto [produk] dengan cahaya putih kebiruan seperti freezer.',
    ]},
    { name: 'Botanical Garden', prompts: [
        '[produk] difoto dengan properti bunga segar di sekeliling.',
        '[produk] di podium marmer dengan background dedaunan hijau.',
        'Flat lay [produk] dengan bunga mawar putih di atas linen.',
        '[produk] floating dengan bunga-bunga kecil berterbangan.',
        'Foto close-up [produk] dengan bunga lavender di background.',
        '[produk] difoto dengan properti tanaman pot kecil.',
    ]},
    { name: 'Glass Dome Showcase', prompts: [
        '[produk] di dalam dome kaca transparan, lighting lembut.',
        'Foto close-up [produk] dengan refleksi dome kaca.',
        '[produk] di podium putih, dome kaca penuh tetesan air.',
        'Foto [produk] floating di dalam efek bubble kaca.',
        '[produk] difoto dengan kaca akrilik bening artistik.',
        'Studio foto [produk] dengan properti kaca melingkar.',
    ]},
    { name: 'Cyber Tech Style', prompts: [
        '[produk] difoto dengan grid LED biru futuristik.',
        'Foto close-up [produk] dengan efek hologram di belakang.',
        '[produk] floating di tengah partikel digital biru.',
        'Studio [produk] dengan latar kode matrix hijau.',
        '[produk] di podium logam futuristik dengan lampu biru.',
        '[produk] difoto dengan refleksi digital glitch effect.',
    ]},
    { name: 'Artistic Shadow Play', prompts: [
        '[produk] difoto dengan shadow pattern dedaunan.',
        '[produk] dengan bayangan garis cahaya jendela.',
        'Foto close-up [produk] dengan shadow diagonal dramatis.',
        '[produk] floating di background putih dengan shadow abstrak.',
        'Foto [produk] dengan bayangan geometris artistik.',
        'Studio foto [produk] dengan kombinasi shadow & light play.',
    ]},
    { name: 'Marble Elegance', prompts: [
        '[produk] diletakkan di podium marmer putih.',
        'Foto close-up [produk] dengan tekstur marmer abu-abu di belakang.',
        '[produk] difoto dengan permukaan marmer glossy reflektif.',
        '[produk] di podium marmer hitam dengan pencahayaan elegan.',
        '[produk] floating di background tekstur marmer putih.',
        'Foto studio [produk] dengan kombinasi marmer dan kaca.',
    ]},
    { name: 'High Fashion Editorial', prompts: [
        '[produk] difoto dengan kain satin mewah di background.',
        'Foto close-up [produk] dengan spotlight dramatis, gaya majalah.',
        '[produk] di podium putih dengan kain hitam mengalir di bawahnya.',
        '[produk] floating dengan kain sutra melayang di sekeliling.',
        'Studio foto [produk] dengan setup fashion editorial high-end.',
        '[produk] dengan lighting kontras dramatis ala runway.',
    ]},
    { name: 'Festive Celebration', prompts: [
        '[produk] dikelilingi confetti emas melayang di studio.',
        'Foto close-up [produk] dengan properti pita perayaan.',
        '[produk] di podium putih dengan balon warna pastel di background.',
        'Foto [produk] dengan efek kembang api mini di belakang.',
        '[produk] floating di tengah confetti berwarna.',
        'Studio foto [produk] dengan nuansa perayaan elegan.',
    ]},
];


// --- DOM ELEMENTS ---
let variationSelect: HTMLSelectElement;
let aspectRatioSelect: HTMLSelectElement;
let generateButton: HTMLButtonElement;
let globalStatusEl: HTMLElement;
let resultsContainer: HTMLElement;
let placeholder: HTMLElement;
let downloadAllButton: HTMLButtonElement;


export async function runProductStudioGeneration() {
    if (!state.productStudioBase64) {
        globalStatusEl.textContent = 'Please upload a product image.';
        return;
    }

    const selectedVariationIndex = parseInt(variationSelect.value, 10);
    const variation = PRODUCT_STUDIO_VARIATIONS[selectedVariationIndex];
    if (!variation) {
        globalStatusEl.textContent = 'Please select a valid style variation.';
        return;
    }
    const aspectRatio = aspectRatioSelect.value;
    
    generateButton.disabled = true;
    placeholder.classList.add('hidden');
    resultsContainer.innerHTML = '';
    state.generatedAssetUrls.length = 0;
    downloadAllButton.classList.add('hidden');

    globalStatusEl.textContent = 'Analyzing product from image...';
    const productDescription = await api.getProductDescription(state.productStudioBase64);
    
    const prompts = variation.prompts.map(p => p.replace(/\[produk\]/g, productDescription));
    globalStatusEl.textContent = `Product identified. Queuing ${prompts.length} generations...`;
    
    // Create placeholder elements first
    const resultItems = prompts.map(() => {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item status loading';
        resultItem.innerHTML = `<p>Queued for generation...</p>`;
        resultsContainer.appendChild(resultItem);
        return resultItem;
    });

    const tasks = resultItems.map((resultItem, i) => async () => {
        const finalPrompt = prompts[i];
        resultItem.innerHTML = `<p>Generating variation ${i + 1}...</p>`;

        try {
            // FIX: Pass the base64 string as an array to match the expected parameter type.
            const result = await api.generateSingleImage(finalPrompt, aspectRatio, [state.productStudioBase64!]);
            if (result) {
                state.generatedAssetUrls.push({ url: result.imageUrl, filename: result.filename });
                const aspectClass = `aspect-${aspectRatio.replace(':', '-')}`;
                resultItem.innerHTML = `
                    <div class="image-container ${aspectClass}">
                        <img src="${result.imageUrl}" alt="Generated product image for: ${finalPrompt}">
                    </div>
                    <p class="card-prompt" style="font-size: 0.8rem; max-height: 50px; overflow-y: auto;">${finalPrompt}</p>
                    <div class="card-actions">
                        <a href="${result.imageUrl}" download="${result.filename}" class="card-button">Download</a>
                        <button class="card-button regenerate-single-image-button" 
                                data-prompt="${encodeURIComponent(finalPrompt)}" 
                                data-aspect-ratio="${aspectRatio}" 
                                data-reference-image="true"
                                data-context="product-studio">
                            Regenerate
                        </button>
                    </div>`;
                resultItem.classList.remove('loading');
                if (downloadAllButton) downloadAllButton.classList.remove('hidden');
            } else {
                throw new Error("Generation returned no result.");
            }
        } catch (error: any) {
             resultItem.innerHTML = `
                <p class="status-error">${error.message}</p>
                <div class="card-actions">
                    <button class="card-button regenerate-single-image-button" 
                            data-prompt="${encodeURIComponent(finalPrompt)}" 
                            data-aspect-ratio="${aspectRatio}"
                            data-reference-image="true"
                            data-context="product-studio">
                        Regenerate
                    </button>
                </div>`;
            resultItem.classList.remove('loading');
        }
    });
    
    // The runWithConcurrency function is available from ui.ts
    await (window as any).runWithConcurrency(tasks, IMAGE_CONCURRENCY_LIMIT);

    globalStatusEl.textContent = 'Product studio generation complete!';
    generateButton.disabled = false;
}


export function initializeProductStudio() {
    variationSelect = document.querySelector('#product-studio-variation-select')!;
    aspectRatioSelect = document.querySelector('#product-studio-aspect-ratio-select')!;
    generateButton = document.querySelector('#generate-button')!;
    globalStatusEl = document.querySelector('#global-status')!;
    resultsContainer = document.querySelector('#results-container')!;
    placeholder = resultsContainer.querySelector('.placeholder')!;
    downloadAllButton = document.querySelector('#download-all-button')!;

    // Populate variations dropdown
    PRODUCT_STUDIO_VARIATIONS.forEach((variation, index) => {
        const option = document.createElement('option');
        option.value = index.toString();
        option.textContent = variation.name;
        variationSelect.appendChild(option);
    });

    // Setup file upload
    setupFileUpload(
        'product-studio-image-input',
        'product-studio-image-preview-container',
        'product-studio-image-preview',
        'remove-product-studio-image-button',
        'product-studio-file-name',
        (base64) => state.setProductStudioBase64(base64 || null)
    );

    // Expose the generation function globally so ui.ts can call it.
    // This is a workaround for modularizing while keeping one entry point.
    (window as any).runProductStudioGeneration = runProductStudioGeneration;
}