export async function parseFile(file, onProgress) {
  const ext = file.name.split('.').pop().toLowerCase();
  
  if (onProgress) onProgress({ status: 'Starting', progress: 0 });

  return new Promise((resolve, reject) => {
    if (ext === 'csv') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          if (window.Papa) {
            const parsed = window.Papa.parse(e.target.result, { skipEmptyLines: true });
            resolve({ type: 'worksheet', sheets: [{ name: file.name, data: parsed.data }] });
          } else {
            reject(new Error("CSV parser not loaded"));
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    } 
    else if (['xlsx', 'xls'].includes(ext)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          if (window.XLSX) {
            const data = new Uint8Array(e.target.result);
            const workbook = window.XLSX.read(data, { type: 'array' });
            const sheets = [];
            
            workbook.SheetNames.forEach(sheetName => {
              const worksheet = workbook.Sheets[sheetName];
              const json = window.XLSX.utils.sheet_to_json(worksheet, { header: 1 });
              if (json.length > 0) {
                sheets.push({ name: sheetName, data: json });
              }
            });
            resolve({ type: 'worksheet', sheets });
          } else {
            reject(new Error("Excel parser not loaded"));
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    }
    else if (ext === 'docx') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          if (window.mammoth) {
            window.mammoth.convertToHtml({ arrayBuffer: e.target.result })
              .then(result => resolve({ type: 'html', content: result.value }))
              .catch(reject);
          } else {
            reject(new Error("Word parser not loaded"));
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    }
    else if (ext === 'pptx') {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          if (window.JSZip) {
            const zip = await window.JSZip.loadAsync(e.target.result);
            let fullText = "";
            const slideFiles = Object.keys(zip.files).filter(name => name.startsWith("ppt/slides/slide") && name.endsWith(".xml"));
            
            for (const slide of slideFiles) {
              const xmlData = await zip.file(slide).async("string");
              const textMatches = xmlData.match(/<a:t>([\s\S]*?)<\/a:t>/g);
              if (textMatches) {
                const slideText = textMatches.map(t => t.replace(/<a:t>/g, '').replace(/<\/a:t>/g, '')).join(' ');
                fullText += `<p><strong>${slide.split('/').pop()}:</strong></p><p>${slideText}</p>`;
              }
            }
            if (!fullText) fullText = "<p>No text found in PPTX.</p>";
            resolve({ type: 'html', content: fullText });
          } else {
            reject(new Error("JSZip not loaded"));
          }
        } catch (err) {
          console.error("PPTX parse error", err);
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    }
    else if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        let ocrText = "";
        try {
          if (window.Tesseract) {
             const result = await window.Tesseract.recognize(e.target.result, 'eng', {
               logger: m => {
                 if (onProgress && m.status === 'recognizing text') {
                   onProgress({ status: 'Running OCR', progress: Math.round(m.progress * 100) });
                 } else if (onProgress) {
                   onProgress({ status: m.status, progress: Math.round(m.progress * 100) });
                 }
               }
             });
             if (result && result.data && result.data.text && result.data.text.trim()) {
               ocrText = `<p><br></p><p><strong>OCR Extracted Text:</strong></p><pre style="white-space: pre-wrap; font-family: monospace; background: var(--surface2); padding: 12px; border-radius: 8px;">${result.data.text}</pre>`;
             }
          }
        } catch (err) {
          console.error("OCR failed", err);
        }
        
        const html = `<img src="${e.target.result}" style="max-width: 100%; border-radius: 4px;" alt="${file.name}" />${ocrText}`;
        resolve({ type: 'html', content: html });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    }
    else if (ext === 'pdf') {
      const reader = new FileReader();
      reader.onload = async (e) => {
        let textLayer = "";
        try {
          if (window.pdfjsLib) {
             const loadingTask = window.pdfjsLib.getDocument({ data: new Uint8Array(e.target.result) });
             const pdf = await loadingTask.promise;
             let fullText = "";
             
             // Native Text Extraction
             for (let i = 1; i <= pdf.numPages; i++) {
                if (onProgress) onProgress({ status: 'Extracting PDF Text', progress: Math.round((i / pdf.numPages) * 100) });
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                if (pageText.trim()) {
                  fullText += `Page ${i}:\n${pageText}\n\n`;
                }
             }
             if (fullText.trim()) {
               textLayer = `<p><br></p><p><strong>PDF Native Text Extraction:</strong></p><pre style="white-space: pre-wrap; font-family: monospace; background: var(--surface2); padding: 12px; border-radius: 8px;">${fullText}</pre>`;
             }
          }
        } catch (err) {
          console.error("PDF Text Extraction failed", err);
        }
        
        let objectUrl = "";
        try {
           objectUrl = URL.createObjectURL(new Blob([e.target.result], { type: 'application/pdf' }));
        } catch (err) {
           console.error("Could not create object URL for PDF", err);
        }

        const html = `<object data="${objectUrl}" type="application/pdf" width="100%" height="800px">
          <p>Unable to display PDF file. <a href="${objectUrl}">Download</a> instead.</p>
        </object>${textLayer}`;
        resolve({ type: 'html', content: html });
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    }
    else if (['txt', 'src', 'js', 'jsx', 'py', 'c', 'cpp', 'html', 'css', 'json', 'md', 'xml', 'java', 'go', 'rs', 'env'].includes(ext)) {
      // Treat strictly as code/text files
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        // Escape HTML to prevent execution
        const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const html = `<pre style="white-space: pre-wrap; font-family: monospace; background: var(--surface2); padding: 12px; border-radius: 8px; color: var(--text);"><code>${escaped}</code></pre>`;
        resolve({ type: 'html', content: html });
      };
      reader.onerror = reject;
      reader.readAsText(file);
    }
    else {
      // Fallback: Try to read as text first, if it has binary garbage, strip it
      const reader = new FileReader();
      reader.onload = (e) => {
        const bytes = new Uint8Array(e.target.result);
        const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
        
        // Remove non-printable ascii and control chars (except basic whitespace)
        // Keep extended unicode for foreign languages
        const printable = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
        const cleanText = printable.replace(/ {4,}/g, '    ').replace(/\n{3,}/g, '\n\n');
        
        const escaped = cleanText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const html = `<p><em>Note: Extracting text from unknown file format (.${ext})</em></p><pre style="white-space: pre-wrap; font-family: monospace; background: var(--surface2); padding: 12px; border-radius: 8px;">${escaped}</pre>`;
        resolve({ type: 'html', content: html });
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    }
  });
}
