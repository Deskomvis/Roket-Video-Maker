/* tslint:disable */
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// This file contains all global state, constants, and helper functions
// for the application. By centralizing state management, we prevent
// circular dependencies and make the code easier to manage.

export const STORYBOARD_PROMPTS = [
    `Dengan menggunakan foto produk dan foto model yang tersedia, buatlah sebuah gambar fotorealistis baru.
Model  sedang di ranjang, wajah penuh jerawat, flek hitam, dan kusam. Model memegang pipi dengan ekspresi kecewa dan tidak percaya diri. Cahaya natural dari jendela kamar masuk lembut. Produk terlihat di meja samping ranjang.

Pertahankan pakaian, dan detail produk.`, // Pose 1
    `Dengan menggunakan foto produk dan foto model yang tersedia, buatlah sebuah gambar fotorealistis baru.
Model  wajah penuh jerawat, flek hitam, dan kusam. Model berdiri di depan cermin kamar mandi modern, menatap wajahnya yang berjerawat dengan ekspresi sedih. Tangan kanan menyentuh pipi. Lampu cermin bundar menyala hangat, menambah suasana dramatis. Produk terlihat di pojok wastafel.

Pertahankan pakaian, dan detail produk.`, // Pose 2
    `Dengan menggunakan foto produk dan foto model yang tersedia, buatlah sebuah gambar fotorealistis baru.
Model  wajah penuh jerawat, flek hitam, dan kusam. Model  memegang produk ke arah kamera. Kamera close-up dengan depth of field, produk tajam sementara wajah model sedikit blur sambil tersenyum tipis penuh harapan. Latar belakang meja rias modern dengan lampu putih bersih.

Pertahankan pakaian, dan detail produk.`, // Pose 3
    `Dengan menggunakan foto produk dan foto model yang tersedia, buatlah sebuah gambar fotorealistis baru.
Model  wajah penuh jerawat, flek hitam, dan kusam. Model sedang memegang produk dan meneteskan produk ke tangan, produk tube tutup sudah dibuka, dan gel berwarna bening kekuningan menetes ke tangan model, tube lurus ke bawah.`, // Pose 4
    `Dengan menggunakan foto produk dan foto model yang tersedia, buatlah sebuah gambar fotorealistis baru.
Model  wajah penuh jerawat, flek hitam, dan kusam. Model sedang membilas wajah dengan air segar dari kran air yang mengalir di wastafel. Kamera side-angle slow motion, butiran air terlihat jelas memercik dari wajah. Ekspresi serius namun lega. Produk berdiri di samping wastafel, terkena percikan air.

Pertahankan pakaian, dan detail produk.`, // Pose 5
    `Dengan menggunakan foto produk dan foto model yang tersedia, buatlah sebuah gambar fotorealistis baru.
Model wajah penuh busa creamy dari Produk, kedua tangan meratakan busa di pipi dan dahi. Kamera close-up menyorot detail tekstur busa. Ekspresi wajah fokus, serius, tapi terasa segar. Background kamar mandi putih bersih. Produk terlihat di wastafel.

Pertahankan pakaian, dan detail produk.`, // Pose 6
    `Dengan menggunakan foto produk dan foto model yang tersedia, buatlah sebuah gambar fotorealistis baru.
Model Ekspresi bahagia sambil tersenyum percaya diri. Kamera portrait close-up. Background putih polos agar fokus ke wajah. Produk dipegang di tangan kiri.

Pertahankan  wajah original, pakaian, dan detail produk.`, // Pose 7
    `Dengan menggunakan foto produk dan foto model yang tersedia, buatlah sebuah gambar fotorealistis baru.
Produk  dipegang model dekat wajah glowing dengan senyum anggun. Kamera perlahan pan dari bawah ke atas, fokus penuh pada produk lalu ke wajah model. Cahaya natural sore dari jendela memberi efek hangat dan elegan. Teks kemasan produk terlihat jelas.
Scene di kamar mandi.

Pertahankan  wajah original, pakaian, dan detail produk.`, // Pose 8
    `Dengan menggunakan foto produk dan foto model yang tersedia, buatlah sebuah gambar fotorealistis baru. Model memegang produk dengan dua tangan di depan dada, tersenyum bangga ke arah kamera. Latar belakang cerah dan bersih. Pertahankan wajah original, pakaian, dan detail produk.` // Pose 9
];

export const VIDEO_STORYBOARD_PROMPTS = [
    `Dengan menggunakan model dan produk di gambar, buat video realistis. Model di atas ranjang. Kamera perlahan zoom-in menyorot ekspresi sedih saat ia menopang pipinya dengan tangan. Produk terlihat di meja samping ranjang. Cahaya natural pagi masuk dari jendela, suasana tenang namun muram.\n\nPertahankan pakaian, dan detail produk.`,
    `Dengan menggunakan model dan produk di gambar, buat video realistis. Model berdiri di depan cermin kamar mandi. Kamera close-up pada wajah di pantulan cermin, tangan menyentuh pipi. Lampu cermin bundar menyala hangat, menambah kesan dramatis.`,
    `Dengan menggunakan model dan produk di gambar, buat video realistis. Kamera fokus ke produk yang diangkat model, lalu perlahan pull focus ke wajahnya yang tersenyum tipis. Cahaya lampu rias menerangi background.\n\nPertahankan pakaian, dan detail produk.`,
    `Dengan menggunakan model dan produk di gambar, buat video realistis. Kamera side angle slow motion, menangkap gerakan gel yang menetes dari produk ke tangan model, gel bening menetes ke tangan dengan smooth.\n\nPertahankan pakaian, dan detail produk.`,
    `Dengan menggunakan model dan produk di gambar, buat video realistis. Kamera side angle slow motion, menangkap gerakan air saat model membasuh wajah. Tetesan air memercik realistis, produk tetap terlihat di samping wastafel.`,
    `Dengan menggunakan model dan produk di gambar, buat video realistis. Kamera close-up menyorot wajah yang penuh busa. Gerakan tangan meratakan busa ke pipi dan dahi`,
    `Dengan menggunakan foto produk dan foto model yang tersedia, buatlah video realistis.\nModel Ekspresi bahagia sambil tersenyum percaya diri. Kamera portrait close-up. \n\nPertahankan  wajah original, pakaian, dan detail produk.`,
    `Dengan menggunakan foto produk dan foto model yang tersedia, buatlah video realistis.\nProduk  dipegang model dekat wajah glowing dengan senyum anggun. Kamera perlahan pan dari bawah ke atas, fokus penuh pada produk lalu ke wajah model. Cahaya natural sore dari jendela memberi efek hangat dan elegan. Teks kemasan produk terlihat jelas.\nScene di kamar mandi.\n\nPertahankan  wajah original, pakaian, dan detail produk.`
];

// Global state
export let activeMode: 'image-studio' | 'image-storyboard' | 'video-storyboard' = 'image-studio';
export const generatedAssetUrls: {url: string; filename: string}[] = [];
export let currentUser: string | null = null;
export let hasApiKey = true; // Assume API key is always available from the environment.

export let productImageBase64 = '';
export let modelImageBase64 = '';
export let faceImageBase64 = '';

// Image Storyboard State
export let imageStoryboardScenes: { id: number; prompt: string; }[] = [];
export let nextImageSceneId = 0;

// Video Storyboard State
export let storyboardScenes: { id: number; file: File | null; base64: string | null; mimeType: string | null; prompt: string; }[] = [];
export let nextSceneId = 0;

// FIX: Add state for Product Studio and Voice Over features
export let productStudioBase64: string | null = null;
export let voiceOverInputMode: 'single' | 'mass' = 'single';
export let voiceOverScript = '';
export let voiceOverSelectedActor = 'Zephyr'; // Default actor

// --- State Modifiers ---
export function setActiveMode(mode: typeof activeMode) { activeMode = mode; }
export function setCurrentUser(name: string) { currentUser = name; }
export function setProductImageBase64(base64: string) { productImageBase64 = base64; }
export function setModelImageBase64(base64: string) { modelImageBase64 = base64; }
export function setFaceImageBase64(base64: string) { faceImageBase64 = base64; }
export function addImageStoryboardScene(scene: { id: number; prompt: string; }) { imageStoryboardScenes.push(scene); }
export function removeImageStoryboardScene(sceneId: number) { imageStoryboardScenes = imageStoryboardScenes.filter(s => s.id !== sceneId); }
export function updateImageStoryboardScenePrompt(sceneId: number, prompt: string) { const scene = imageStoryboardScenes.find(s => s.id === sceneId); if (scene) scene.prompt = prompt; }
export function getNextImageSceneId() { return nextImageSceneId++; }
export function resetImageStoryboard() { imageStoryboardScenes = []; nextImageSceneId = 0; }
export function addStoryboardScene(scene: { id: number; file: File | null; base64: string | null; mimeType: string | null; prompt: string; }) { storyboardScenes.push(scene); }
export function removeStoryboardScene(sceneId: number) { storyboardScenes = storyboardScenes.filter(s => s.id !== sceneId); }
export function updateStoryboardScene(sceneId: number, data: Partial<typeof storyboardScenes[0]>) { const scene = storyboardScenes.find(s => s.id === sceneId); if (scene) Object.assign(scene, data); }
export function getNextSceneId() { return nextSceneId++; }
export function resetStoryboard() { storyboardScenes = []; nextSceneId = 0; }

// FIX: Add state modifiers for Product Studio and Voice Over features
export function setProductStudioBase64(base64: string | null) { productStudioBase64 = base64; }
export function setVoiceOverInputMode(mode: 'single' | 'mass') { voiceOverInputMode = mode; }
export function setVoiceOverScript(script: string) { voiceOverScript = script; }
export function setVoiceOverSelectedActor(actor: string) { voiceOverSelectedActor = actor; }

// Helper to convert file to base64
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]);
      } else {
        reject(new Error('Failed to read file as base64 string.'));
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}