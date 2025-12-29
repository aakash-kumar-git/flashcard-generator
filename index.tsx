/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Type } from '@google/genai';

interface Flashcard {
  term: string;
  definition: string;
}

const topicInput = document.getElementById('topicInput') as HTMLTextAreaElement;
const generateButton = document.getElementById('generateButton') as HTMLButtonElement;
const downloadButton = document.getElementById('downloadButton') as HTMLButtonElement;
const addFilesButton = document.getElementById('addFilesButton') as HTMLButtonElement;
const addFilesDropdown = document.getElementById('addFilesDropdown') as HTMLDivElement;
const fileInput = document.getElementById('fileInput') as HTMLInputElement;
const flashcardsContainer = document.getElementById('flashcardsContainer') as HTMLDivElement;
const errorMessage = document.getElementById('errorMessage') as HTMLDivElement;
const statusMessage = document.getElementById('statusMessage') as HTMLDivElement;

const addImgOpt = document.getElementById('addImgOpt') as HTMLDivElement;
const addVidOpt = document.getElementById('addVidOpt') as HTMLDivElement;
const addDocOpt = document.getElementById('addDocOpt') as HTMLDivElement;

const themeButton = document.getElementById('themeButton') as HTMLButtonElement;
const themeDropdown = document.getElementById('themeDropdown') as HTMLDivElement;
const themeLight = document.getElementById('themeLight') as HTMLDivElement;
const themeDark = document.getElementById('themeDark') as HTMLDivElement;
const themeSystem = document.getElementById('themeSystem') as HTMLDivElement;
const currentThemeIcon = document.getElementById('currentThemeIcon') as HTMLSpanElement;

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

let processingInterval: number | null = null;
let addedUrls: string[] = []; 
let isShowingResults = false;
let currentFlashcards: Flashcard[] = [];

const recycleIcon = `<svg style="margin-right: 8px; vertical-align: middle;" xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 126.5 24.5T708-708l60-60v220H548l80-80q-34-31-77.5-46.5T480-690q-104 0-177 73t-73 177q0 104 73 177t177 73q72 0 129.5-36t92.5-98h86q-39 101-127 162.5T480-160Z"/></svg>`;

// Theme Logic
type Theme = 'light' | 'dark' | 'system';

const themeIcons = {
  light: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -360 960 24" width="24" fill="currentColor"><path d="M480-360q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35Zm0 80q-83 0-141.5-58.5T280-480q0-83 58.5-141.5T480-680q83 0 141.5 58.5T680-480q0 83-58.5 141.5T480-280ZM200-440H40v-80h160v80Zm720 0H760v-80h160v80Zm-440-320v-160h80v160h-80Zm0 720v-160h80v160h-80ZM256-650l-101-101 57-57 101 101-57 57ZM548 548-101-101 57-57 101 101-57 57ZM212-212l101-101 57 57-101 101-57-57Zm548-548 101-101 57 57-101 101-57-57Z"/></svg>`,
  dark: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="M480-120q-150 0-255-105T120-480q0-150 105-255t255-105q14 0 27.5 1t26.5 3q-41 29-65 74.5T440-660q0 85 59.5 144.5T644-456q49 0 94.5-24t74.5-65q2 13 3 26.5t1 27.5q0 150-105 255T480-120Z"/></svg>`,
  system: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-840h640q33 0 56.5 23.5T880-760v480q0 33-23.5 56.5T800-160H160Zm0-80h640v-480H160v480Zm0 0v-480 480Zm240 0h160v-40H400v40Z"/></svg>`
};

const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  if (theme === 'system') {
    root.style.colorScheme = 'light dark';
    currentThemeIcon.innerHTML = themeIcons.system;
  } else {
    root.style.colorScheme = theme;
    currentThemeIcon.innerHTML = themeIcons[theme];
  }
  localStorage.setItem('app-theme', theme);
};

applyTheme((localStorage.getItem('app-theme') as Theme) || 'system');

const closeAllDropdowns = () => {
  addFilesDropdown.classList.remove('show');
  themeDropdown.classList.remove('show');
};

themeButton.addEventListener('click', (e) => {
  e.stopPropagation();
  const isShown = themeDropdown.classList.contains('show');
  closeAllDropdowns();
  if (!isShown) themeDropdown.classList.add('show');
});

addFilesButton.addEventListener('click', (e) => {
  e.stopPropagation();
  const isShown = addFilesDropdown.classList.contains('show');
  closeAllDropdowns();
  if (!isShown) addFilesDropdown.classList.add('show');
});

window.addEventListener('click', closeAllDropdowns);

themeLight.addEventListener('click', () => applyTheme('light'));
themeDark.addEventListener('click', () => applyTheme('dark'));
themeSystem.addEventListener('click', () => applyTheme('system'));

const triggerFileInput = (accept: string) => {
  fileInput.accept = accept;
  fileInput.click();
  closeAllDropdowns();
};

addImgOpt.addEventListener('click', () => triggerFileInput('image/*'));
addVidOpt.addEventListener('click', () => triggerFileInput('video/*'));
addDocOpt.addEventListener('click', () => triggerFileInput('.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document'));

const updateFeedback = () => {
  const files = fileInput.files;
  const urlCount = addedUrls.length;
  const text = topicInput.value.trim();

  let parts = [];
  if (text) parts.push("Topic set.");

  if (files && files.length > 0) {
    let images = 0, videos = 0, docs = 0, other = 0;
    const sampleNames = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const type = f.type.toLowerCase();
      const name = f.name.toLowerCase();
      if (type.startsWith('image/')) images++;
      else if (type.startsWith('video/')) videos++;
      else if (type.includes('pdf') || type.includes('word') || name.endsWith('.pdf') || name.endsWith('.docx')) docs++;
      else other++;
      if (files.length <= 2) sampleNames.push(f.name);
    }
    let fileDesc = `${files.length} file${files.length > 1 ? 's' : ''}`;
    const typeBreakdown = [];
    if (images > 0) typeBreakdown.push(`${images} image${images > 1 ? 's' : ''}`);
    if (videos > 0) typeBreakdown.push(`${videos} video${videos > 1 ? 's' : ''}`);
    if (docs > 0) typeBreakdown.push(`${docs} doc${docs > 1 ? 's' : ''}`);
    if (other > 0) typeBreakdown.push(`${other} other`);
    if (typeBreakdown.length > 0) fileDesc += ` (${typeBreakdown.join(', ')})`;
    if (sampleNames.length > 0) fileDesc += `: ${sampleNames.join(', ')}`;
    parts.push(fileDesc);
  }
  if (urlCount > 0) parts.push(`${urlCount} URL${urlCount > 1 ? 's' : ''} added.`);

  if (parts.length > 0) {
    errorMessage.textContent = parts.join(" • ");
    errorMessage.style.color = 'light-dark(var(--light-primary), var(--dark-primary))';
    statusMessage.textContent = '';
  } else {
    errorMessage.textContent = '';
  }
};

topicInput.addEventListener('input', updateFeedback);
fileInput.addEventListener('change', updateFeedback);

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

const startProcessingAnimation = () => {
  let dots = 0;
  errorMessage.style.color = 'light-dark(var(--light-text-secondary), var(--dark-text-secondary))';
  processingInterval = window.setInterval(() => {
    dots = (dots + 1) % 4;
    errorMessage.textContent = 'Processing' + '.'.repeat(dots);
  }, 400);
};

const stopProcessingAnimation = () => {
  if (processingInterval !== null) {
    clearInterval(processingInterval);
    processingInterval = null;
  }
};

const setButtonState = (generated: boolean) => {
  isShowingResults = generated;
  if (generated) {
    generateButton.innerHTML = recycleIcon + "Generate Another";
    downloadButton.classList.remove('hidden');
  } else {
    generateButton.textContent = "Generate Flashcards";
    downloadButton.classList.add('hidden');
  }
};

const resetInputs = () => {
  topicInput.value = "";
  fileInput.value = "";
  addedUrls = [];
  flashcardsContainer.textContent = "";
  statusMessage.textContent = "";
  errorMessage.textContent = "";
  currentFlashcards = [];
  updateFeedback();
  setButtonState(false);
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

downloadButton.addEventListener('click', () => {
  if (currentFlashcards.length === 0) return;
  
  const content = currentFlashcards.map(f => `${f.term}: ${f.definition}`).join('\n');
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'flashcards.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

generateButton.addEventListener('click', async () => {
  if (isShowingResults) {
    resetInputs();
    return;
  }

  const topic = topicInput.value.trim();
  const files = fileInput.files;
  const hasFiles = files && files.length > 0;
  const hasUrls = addedUrls.length > 0;

  if (!topic && !hasFiles && !hasUrls) {
    errorMessage.textContent = 'Please provide a topic, a file, or a URL.';
    errorMessage.style.color = 'light-dark(var(--light-error), var(--dark-error))';
    statusMessage.textContent = '';
    flashcardsContainer.textContent = '';
    return;
  }

  statusMessage.textContent = '';
  flashcardsContainer.textContent = '';
  generateButton.disabled = true;
  
  startProcessingAnimation();

  try {
    const parts: any[] = [];
    let promptText = `Generate flashcards based on the provided topic and attached multi-modal content.

TOPIC OF INTEREST: ${topic || "General Study"}

INSTRUCTIONS:
1. Carefully analyze all provided sources (Text, Images, Documents, Videos).
2. Extract key terms, concepts, definitions, or equations.
3. If a Video is provided, analyze the visual information and any text displayed within the frames.
4. If a PDF is provided, extract high-level academic concepts and specific definitions.
5. Create concise, clear Term-Definition pairs suitable for study.
6. Return only the extracted information from these sources.

SOURCES:
- Input Topic/Description: ${topic || "N/A"}
`;

    if (hasUrls) promptText += `- External URLs to reference: ${addedUrls.join(", ")}\n`;
    
    if (hasFiles) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const base64 = await fileToBase64(file);
        
        let mimeType = file.type;
        if (!mimeType) {
            if (file.name.endsWith('.pdf')) mimeType = 'application/pdf';
            else if (file.name.endsWith('.docx')) mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        }

        parts.push({ 
          inlineData: { 
            data: base64, 
            mimeType: mimeType || 'application/octet-stream' 
          } 
        });
      }
    }

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts },
      config: {
        systemInstruction: "You are a professional educational assistant specializing in flashcard creation from multi-modal inputs. Your goal is to identify core concepts from images, videos, and documents (PDFs). For documents, focus on headings, bolded text, and definitions. For videos, focus on the subject matter and visible text. Format your output strictly as a JSON array of objects with 'term' and 'definition' keys. Ensure accuracy and pedagogical value.",
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }],
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              term: { type: Type.STRING },
              definition: { type: Type.STRING },
            },
            required: ["term", "definition"]
          }
        }
      }
    });

    const flashcards: Flashcard[] = JSON.parse(response.text || "[]");
    stopProcessingAnimation();

    if (flashcards.length > 0) {
      currentFlashcards = flashcards;
      statusMessage.textContent = `Generated ${flashcards.length} flashcards!`;
      errorMessage.textContent = 'Extraction Success';
      errorMessage.style.color = 'light-dark(var(--light-success), var(--dark-success))';

      flashcards.forEach((flashcard, index) => {
        const cardDiv = document.createElement('div');
        cardDiv.classList.add('flashcard');
        cardDiv.style.animationDelay = `${index * 0.08}s`;

        const cardInner = document.createElement('div');
        cardInner.classList.add('flashcard-inner');

        const cardFront = document.createElement('div');
        cardFront.classList.add('flashcard-front');
        const termDiv = document.createElement('div');
        termDiv.classList.add('term');
        termDiv.textContent = flashcard.term;

        const cardBack = document.createElement('div');
        cardBack.classList.add('flashcard-back');
        const definitionDiv = document.createElement('div');
        definitionDiv.classList.add('definition');
        definitionDiv.textContent = flashcard.definition;

        cardFront.appendChild(termDiv);
        cardBack.appendChild(definitionDiv);
        cardInner.appendChild(cardFront);
        cardInner.appendChild(cardBack);
        cardDiv.appendChild(cardInner);
        flashcardsContainer.appendChild(cardDiv);

        cardDiv.addEventListener('click', () => {
          cardDiv.classList.toggle('flipped');
        });
      });

      setButtonState(true);
      
      setTimeout(() => {
        flashcardsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);

    } else {
      errorMessage.textContent = 'No relevant concepts found in sources.';
      statusMessage.textContent = 'Try a more specific topic or clearer document/video.';
    }
  } catch (error: unknown) {
    stopProcessingAnimation();
    const detailedError = (error as Error)?.message || 'Generation error';
    errorMessage.textContent = 'Could not process content.';
    errorMessage.style.color = 'light-dark(var(--light-error), var(--dark-error))';
    statusMessage.textContent = detailedError;
    statusMessage.style.color = 'light-dark(var(--light-error), var(--dark-error))';
    flashcardsContainer.textContent = '';
  } finally {
    generateButton.disabled = false;
  }
});
