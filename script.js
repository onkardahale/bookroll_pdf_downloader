// BookRoll PDF Extractor - Improved Implementation
// This script will extract images from BookRoll pages and compile them
// To use:
// 1. Open BookRoll with your document
// 2. Open developer console (F12)
// 3. Paste and run this code
// 4. Follow the instructions in the UI that appears

(async function() {
    console.log("BookRoll PDF Extractor starting...");
    
    // Create UI for the extractor
    const ui = document.createElement('div');
    ui.id = 'bookroll-extractor';
    ui.style.position = 'fixed';
    ui.style.top = '10px';
    ui.style.right = '10px';
    ui.style.zIndex = '10000';
    ui.style.background = 'rgba(0, 0, 0, 0.8)';
    ui.style.color = 'white';
    ui.style.padding = '15px';
    ui.style.borderRadius = '8px';
    ui.style.width = '300px';
    ui.style.fontFamily = 'Arial, sans-serif';
    ui.style.fontSize = '14px';
    ui.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
    
    ui.innerHTML = `
      <div style="margin-bottom:10px;font-weight:bold;font-size:16px;border-bottom:1px solid #555;padding-bottom:5px;">
        BookRoll PDF Extractor
      </div>
      <div id="status" style="margin-bottom:10px;color:#aaa;font-size:12px;">
        Analyzing page structure...
      </div>
      <div style="margin-bottom:15px;">
        <div style="margin-bottom:5px;font-size:12px;">Progress: <span id="progress">0/0</span></div>
        <div style="height:10px;background:#333;border-radius:5px;overflow:hidden;">
          <div id="progress-bar" style="height:100%;width:0%;background:#4CAF50;transition:width 0.3s;"></div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <button id="analyze-btn" style="background:#2196F3;border:none;color:white;padding:8px;border-radius:4px;cursor:pointer;">
          1. Analyze Structure
        </button>
        <button id="extract-btn" style="background:#4CAF50;border:none;color:white;padding:8px;border-radius:4px;cursor:pointer;" disabled>
          2. Extract All Pages
        </button>
        <button id="download-btn" style="background:#FF9800;border:none;color:white;padding:8px;border-radius:4px;cursor:pointer;" disabled>
          3. Download ZIP
        </button>
      </div>
      <div id="log" style="margin-top:10px;font-size:11px;height:100px;overflow-y:auto;background:#222;padding:5px;border-radius:4px;">
        Log will appear here...
      </div>
      <div style="text-align:right;margin-top:5px;">
        <a href="#" id="close-btn" style="color:#aaa;font-size:12px;text-decoration:none;">Close</a>
      </div>
    `;
    
    document.body.appendChild(ui);
    
    // Elements
    const statusEl = document.getElementById('status');
    const progressEl = document.getElementById('progress');
    const progressBarEl = document.getElementById('progress-bar');
    const analyzeBtn = document.getElementById('analyze-btn');
    const extractBtn = document.getElementById('extract-btn');
    const downloadBtn = document.getElementById('download-btn');
    const logEl = document.getElementById('log');
    const closeBtn = document.getElementById('close-btn');
    
    // State
    let totalPages = 0;
    let currentPage = 0;
    let extractedImages = [];
    let pageNavigationInfo = null;
    let previousImageFingerprints = new Map(); // Store image fingerprints to detect duplicates
    
    // Helper function to log
    function log(message) {
      const logEntry = document.createElement('div');
      logEntry.textContent = message;
      logEl.appendChild(logEntry);
      logEl.scrollTop = logEl.scrollHeight;
      console.log(message);
    }
    
    // Helper function to update progress
    function updateProgress(current, total) {
      progressEl.textContent = `${current}/${total}`;
      progressBarEl.style.width = `${(current / total) * 100}%`;
    }
    
    // Function to generate a simple hash from an image source
    function generateImageFingerprint(imgSrc) {
      // Simple hash function for image URLs
      let hash = 0;
      for (let i = 0; i < imgSrc.length; i++) {
        const char = imgSrc.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return hash.toString();
    }
    
    // Main functions
    async function analyzeStructure() {
      log("Analyzing BookRoll structure...");
      statusEl.textContent = "Analyzing page structure...";
      
      // Find all iframes that could contain BookRoll
      const iframes = document.querySelectorAll('iframe');
      let bookrollFrame = null;
      
      for (const iframe of iframes) {
        try {
          // Try to access the iframe content (might fail due to same-origin policy)
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          
          // Look for BookRoll-specific elements in the iframe
          const hasBookRoll = 
            iframeDoc.querySelector('.bookroll') || 
            iframeDoc.querySelector('[class*="book"]') || 
            iframe.src.includes('bookroll') || 
            iframe.src.includes('book') ||
            iframeDoc.title.includes('Book');
          
          if (hasBookRoll) {
            log(`Found BookRoll iframe: ${iframe.src}`);
            bookrollFrame = iframe;
            break;
          }
        } catch (e) {
          // Iframe access denied due to same-origin policy
          log(`Could not access iframe: ${iframe.src}`);
        }
      }
      
      if (!bookrollFrame) {
        // Try to find direct BookRoll elements if not in iframe
        const bookrollElements = 
          document.querySelector('.bookroll') || 
          document.querySelector('[class*="book"]') ||
          document.querySelector('[id*="book"]');
        
        if (bookrollElements) {
          log("Found BookRoll elements directly in the page");
          bookrollFrame = { contentWindow: window, contentDocument: document };
        } else {
          log("ERROR: Could not find BookRoll container. Make sure you run this on a BookRoll page.");
          statusEl.textContent = "Error: BookRoll not found";
          return;
        }
      }
      
      // Analyze the page structure
      const doc = bookrollFrame.contentDocument || bookrollFrame.contentWindow.document;
      
      // Find pagination info
      const pageInfo = doc.querySelector('[class*="page-num"], [class*="pageNum"], [id*="page"], .page-indicator');
      
      if (pageInfo) {
        const pageText = pageInfo.textContent;
        const pageMatch = pageText.match(/(\d+)\s*\/\s*(\d+)/);
        
        if (pageMatch && pageMatch[2]) {
          currentPage = parseInt(pageMatch[1], 10);
          totalPages = parseInt(pageMatch[2], 10);
          log(`Found page information: ${currentPage}/${totalPages}`);
        }
      }
      
      if (!totalPages) {
        // Try to find other indicators of total pages
        const pageElements = doc.querySelectorAll('[class*="page"]');
        pageElements.forEach(el => {
          if (el.textContent.includes('/')) {
            const match = el.textContent.match(/(\d+)\s*\/\s*(\d+)/);
            if (match && match[2]) {
              currentPage = parseInt(match[1], 10);
              totalPages = parseInt(match[2], 10);
            }
          }
        });
      }
      
      if (!totalPages) {
        log("Could not determine total pages automatically.");
        const pagesPrompt = prompt("Could not detect total pages. Please enter the total number of pages:", "");
        totalPages = parseInt(pagesPrompt, 10) || 0;
      }
      
      // Find navigation buttons
      const nextButtons = doc.querySelectorAll('button[id*="next"], a[id*="next"], [class*="next"], [aria-label*="next"]');
      const prevButtons = doc.querySelectorAll('button[id*="prev"], a[id*="prev"], [class*="prev"], [aria-label*="previous"]');
      
      if (nextButtons.length === 0) {
        // Try to find navigation arrows
        const allButtons = doc.querySelectorAll('button, a, [role="button"]');
        for (const btn of allButtons) {
          const text = btn.textContent.trim().toLowerCase();
          if (text === '>' || text === '→' || text === 'next') {
            nextButtons.push(btn);
          }
        }
      }
      
      // Find the main image container
      let mainContent = null;
      const contentContainers = [
        doc.querySelector('[id*="content"]'),
        doc.querySelector('[class*="content"]'),
        doc.querySelector('[class*="page-content"]'),
        doc.querySelector('[class*="book-content"]')
      ].filter(Boolean);
      
      if (contentContainers.length > 0) {
        mainContent = contentContainers[0];
        log(`Found main content container: ${mainContent.tagName} ${mainContent.id || mainContent.className}`);
      }
      
      // Store the navigation info
      pageNavigationInfo = {
        bookrollFrame,
        totalPages,
        currentPage,
        nextButtons: Array.from(nextButtons),
        prevButtons: Array.from(prevButtons),
        mainContent,
        doc
      };
      
      // Update UI
      statusEl.textContent = `Found ${totalPages} pages`;
      updateProgress(0, totalPages);
      extractBtn.disabled = false;
      
      log(`Analysis complete. Found ${totalPages} pages.`);
      
      return pageNavigationInfo;
    }
    
    // Extract the current page with improved detection and fallback mechanisms
    function extractCurrentPage(info) {
      const doc = info.doc;
      
      // Find all images on the page
      const images = Array.from(doc.querySelectorAll('img')).filter(img => {
        // Filter out tiny images like icons
        const area = img.width * img.height;
        return area > 10000; // Arbitrary threshold for "main content" images
      });
      
      if (images.length > 0) {
        // Sort by area (largest first)
        images.sort((a, b) => {
          const areaA = a.width * a.height;
          const areaB = b.width * b.height;
          return areaB - areaA;
        });
        
        // Get the largest image
        const largestImage = images[0];
        
        // Calculate image fingerprint
        const imgFingerprint = generateImageFingerprint(largestImage.src);
        
        // Generate a unique source URL with timestamp and page number to ensure uniqueness
        const uniqueSrc = largestImage.src.includes('?') ? 
          `${largestImage.src}&_page=${info.currentPage}&_ts=${Date.now()}` : 
          `${largestImage.src}?_page=${info.currentPage}&_ts=${Date.now()}`;
        
        log(`Found main image on page ${info.currentPage}: ${largestImage.src}`);
        
        // Check if this image has already been encountered at a different page number
        if (previousImageFingerprints.has(imgFingerprint) && 
            previousImageFingerprints.get(imgFingerprint) !== info.currentPage) {
          log(`WARNING: Image on page ${info.currentPage} appears identical to image on page ${previousImageFingerprints.get(imgFingerprint)}`);
          log(`Using fallback capture method to ensure uniqueness`);
          return captureViewportAsFallback(info);
        }
        
        // Store the fingerprint with current page
        previousImageFingerprints.set(imgFingerprint, info.currentPage);
        
        return {
          src: uniqueSrc,
          originalSrc: largestImage.src,
          pageNum: info.currentPage
        };
      }
      
      // If no images found, try to find canvas elements that might be rendering the page
      const canvases = Array.from(doc.querySelectorAll('canvas')).filter(canvas => {
        const area = canvas.width * canvas.height;
        return area > 10000; // Arbitrary threshold
      });
      
      if (canvases.length > 0) {
        // Sort by area (largest first)
        canvases.sort((a, b) => {
          const areaA = a.width * a.height;
          const areaB = b.width * b.height;
          return areaB - areaA;
        });
        
        const largestCanvas = canvases[0];
        log(`Found canvas on page ${info.currentPage}, capturing as image...`);
        
        try {
          // Add pageNum parameter to ensure uniqueness
          const dataUrl = largestCanvas.toDataURL('image/png');
          return {
            src: dataUrl,
            pageNum: info.currentPage
          };
        } catch (e) {
          log(`Error capturing canvas on page ${info.currentPage}: ${e.message}`);
        }
      }
      
      // If we still couldn't find an image, try to look for PDF.js viewers
      const pdfJsCanvas = doc.querySelector('.canvasWrapper canvas');
      if (pdfJsCanvas) {
        log(`Found PDF.js canvas on page ${info.currentPage}, capturing...`);
        try {
          const dataUrl = pdfJsCanvas.toDataURL('image/png');
          return {
            src: dataUrl,
            pageNum: info.currentPage
          };
        } catch (e) {
          log(`Error capturing PDF.js canvas: ${e.message}`);
        }
      }
      
      // Last resort: capture the viewport
      return captureViewportAsFallback(info);
    }
    
    // Fallback method to capture viewport when image detection fails
    function captureViewportAsFallback(info) {
        log(`Enhanced fallback: Capturing actual rendered content for page ${info.currentPage}`);
        
        // Find all canvas elements in the document that might contain our content
        const allCanvases = Array.from(info.doc.querySelectorAll('canvas')).filter(canvas => {
          return canvas.width > 100 && canvas.height > 100; // Filter out tiny UI canvases
        });
        
        // Sort by area (largest first) to find main content canvas
        allCanvases.sort((a, b) => {
          return (b.width * b.height) - (a.width * a.height);
        });
        
        if (allCanvases.length > 0) {
          try {
            // Use the largest canvas as the most likely content container
            const contentCanvas = allCanvases[0];
            log(`Found content canvas (${contentCanvas.width}x${contentCanvas.height}) for fallback capture`);
            
            // Create a new canvas to combine the content with our metadata
            const canvas = document.createElement('canvas');
            canvas.width = contentCanvas.width;
            canvas.height = contentCanvas.height;
            const ctx = canvas.getContext('2d');
            
            // Copy the content from the original canvas
            ctx.drawImage(contentCanvas, 0, 0);
            
            // Add semi-transparent overlay to ensure content is visible but marked as fallback
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Add page identifier in a non-obtrusive corner position
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(10, 10, 120, 30);
            ctx.font = 'bold 16px Arial';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left';
            ctx.fillText(`Page ${info.currentPage}`, 20, 30);
            
            return {
              src: canvas.toDataURL('image/png'),
              pageNum: info.currentPage,
              isFallback: true
            };
          } catch (e) {
            log(`Error capturing canvas content: ${e.message}`);
            // Fall back to our placeholder if canvas capture fails
          }
        }
        
        // If we couldn't find a suitable canvas or capture failed, use advanced DOM-to-canvas
        log(`Attempting DOM-to-Canvas fallback for page ${info.currentPage}`);
        
        // Find the main content container
        const contentContainer = info.mainContent || info.doc.body;
        
        // Create a placeholder canvas
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        const ctx = canvas.getContext('2d');
        
        // Draw structured visual placeholder with page information
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add a more visually distinct border
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 2;
        ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
        
        // Add header area
        ctx.fillStyle = '#f2f2f2';
        ctx.fillRect(5, 5, canvas.width - 10, 60);
        
        // Add page number text
        ctx.font = 'bold 48px Arial';
        ctx.fillStyle = '#333333';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`Page ${info.currentPage}`, canvas.width/2, 35);
        
        // Add note
        ctx.font = '16px Arial';
        ctx.fillText('(Fallback capture - original content unavailable)', canvas.width/2, canvas.height/2);
        
        // Add diagnostic information
        ctx.font = '12px Arial';
        ctx.fillStyle = '#666666';
        ctx.textAlign = 'left';
        ctx.fillText(`Detected ViewerType: ${info.viewerType || 'Unknown'}`, 20, canvas.height - 60);
        ctx.fillText(`Content Elements: ${contentContainer.children.length}`, 20, canvas.height - 40);
        
        // Add timestamp
        ctx.textAlign = 'center';
        ctx.fillText(new Date().toLocaleString(), canvas.width/2, canvas.height - 20);
        
        return {
          src: canvas.toDataURL('image/png'),
          pageNum: info.currentPage,
          isFallback: true
        };
      }
    
    // Navigate to the next page with improved verification and timing
    function goToNextPage(info) {
        return new Promise((resolve, reject) => {
          if (info.currentPage >= info.totalPages) {
            resolve(false); // No more pages
            return;
          }
          
          const doc = info.doc;
          
          // Capture pre-navigation state
          const beforeNavigation = {
            logs: [],
            pageNum: info.currentPage
          };
          
          // Set up console.log interceptor to detect rendering events
          const originalConsoleLog = console.log;
          console.log = function(message) {
            beforeNavigation.logs.push(message);
            originalConsoleLog.apply(console, arguments);
          };
          
          // Click the next button
          if (info.nextButtons && info.nextButtons.length > 0) {
            const nextButton = info.nextButtons[0];
            log(`Initiating navigation from page ${info.currentPage}`);
            
            // Click the button
            nextButton.click();
            
            // Set up rendering cycle detection
            let renderingComplete = false;
            let onloadDetected = false;
            let pollCount = 0;
            const maxPolls = 30; // Maximum number of polling attempts
            
            // Polling function to check for rendering completion
            const checkRenderingComplete = () => {
              pollCount++;
              
              // Check if onload event has been detected
              if (beforeNavigation.logs.includes('onload')) {
                onloadDetected = true;
              }
              
              // If we've detected the rendering cycle or hit max polls
              if (onloadDetected || pollCount >= maxPolls) {
                // Restore original console.log
                console.log = originalConsoleLog;
                
                // Update page number based on UI or increment
                const pageInfo = doc.querySelector('[class*="page-num"], [class*="pageNum"], [id*="page"], .page-indicator');
                if (pageInfo) {
                  const pageText = pageInfo.textContent;
                  const pageMatch = pageText.match(/(\d+)\s*\/\s*(\d+)/);
                  
                  if (pageMatch && pageMatch[1]) {
                    info.currentPage = parseInt(pageMatch[1], 10);
                    log(`Navigation confirmed via UI: now on page ${info.currentPage}`);
                  } else {
                    info.currentPage = beforeNavigation.pageNum + 1;
                    log(`Navigation assumed: incrementing to page ${info.currentPage}`);
                  }
                } else {
                  info.currentPage = beforeNavigation.pageNum + 1;
                  log(`Navigation assumed: incrementing to page ${info.currentPage}`);
                }
                
                // Final verification delay to ensure rendering is complete
                setTimeout(() => {
                  resolve(true);
                }, 500);
                
                return;
              }
              
              // Continue polling
              setTimeout(checkRenderingComplete, 200);
            };
            
            // Start polling
            checkRenderingComplete();
          } else {
            console.log = originalConsoleLog;
            log("No next button found, cannot navigate");
            reject(new Error("No next button found"));
          }
        });
      }
    
    // Extract all pages with improved reliability
    async function extractAllPages() {
      if (!pageNavigationInfo) {
        log("Please analyze the structure first");
        return;
      }
      
      statusEl.textContent = "Extracting pages...";
      extractBtn.disabled = true;
      
      const info = pageNavigationInfo;
      extractedImages = [];
      previousImageFingerprints.clear(); // Reset fingerprint tracking
      
      // Ensure we start from the first page by setting currentPage to 1
      // This ensures consistency regardless of what page we're currently viewing
      info.currentPage = 1;
      
      // Try to navigate to the first page if not already there
      // This is a new addition to ensure we start from page 1
      if (info.prevButtons && info.prevButtons.length > 0 && info.totalPages > 1) {
        log("Attempting to navigate to first page...");
        
        // Click the prev button multiple times to get to the first page
        // This is a simple way to ensure we're at the first page
        for (let i = 0; i < info.totalPages; i++) {
          info.prevButtons[0].click();
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        // Wait for the page to settle
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Reset current page to 1
        info.currentPage = 1;
        log("Reset to first page");
      }
      
      try {
        log(`Starting extraction of ${info.totalPages} pages...`);
        
        for (let i = 0; i < info.totalPages; i++) {
          // Extract current page - with improved tracking
          log(`Processing page ${info.currentPage} (${i+1}/${info.totalPages})...`);
          
          // Add small delay to ensure page is fully rendered
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const imageInfo = extractCurrentPage(info);
          if (imageInfo) {
            extractedImages.push(imageInfo);
            log(`Successfully extracted page ${imageInfo.pageNum} content`);
          } else {
            log(`Failed to extract content from page ${info.currentPage}`);
            
            // Add a fallback image if extraction failed
            extractedImages.push(captureViewportAsFallback(info));
          }
          
          // Update progress
          updateProgress(i + 1, info.totalPages);
          
          // Go to next page if we haven't reached the end
          if (i < info.totalPages - 1) {
            try {
              await goToNextPage(info);
            } catch (e) {
              log(`Error navigating to next page: ${e.message}`);
              break;
            }
          }
        }
        
        statusEl.textContent = `Extracted ${extractedImages.length}/${info.totalPages} pages`;
        downloadBtn.disabled = false;
        log(`Extraction complete: ${extractedImages.length} pages extracted`);
        
        // Validate all extracted images have correct page numbers
        const missingPages = [];
        const duplicatePages = new Set();
        const pageNumbersFound = new Set();
        
        extractedImages.forEach(img => {
          if (pageNumbersFound.has(img.pageNum)) {
            duplicatePages.add(img.pageNum);
          }
          pageNumbersFound.add(img.pageNum);
        });
        
        for (let p = 1; p <= info.totalPages; p++) {
          if (!pageNumbersFound.has(p)) {
            missingPages.push(p);
          }
        }
        
        if (missingPages.length > 0) {
          log(`WARNING: The following pages were not extracted: ${missingPages.join(', ')}`);
        }
        
        if (duplicatePages.size > 0) {
          log(`WARNING: The following pages appear more than once: ${[...duplicatePages].join(', ')}`);
        }
        
      } catch (error) {
        log(`Error during extraction: ${error.message}`);
        statusEl.textContent = "Error during extraction";
      }
    }
    
    // Download as ZIP with improved handling
    async function downloadImages() {
      if (extractedImages.length === 0) {
        log("No images to download");
        return;
      }
      
      statusEl.textContent = "Preparing download...";
      
      // Create download container
      const downloadContainer = document.createElement('div');
      downloadContainer.style.position = 'fixed';
      downloadContainer.style.top = '50%';
      downloadContainer.style.left = '50%';
      downloadContainer.style.transform = 'translate(-50%, -50%)';
      downloadContainer.style.backgroundColor = '#fff';
      downloadContainer.style.padding = '20px';
      downloadContainer.style.borderRadius = '8px';
      downloadContainer.style.zIndex = '10001';
      downloadContainer.style.maxWidth = '400px';
      downloadContainer.style.maxHeight = '80vh';
      downloadContainer.style.overflow = 'auto';
      downloadContainer.style.boxShadow = '0 0 20px rgba(0, 0, 0, 0.5)';
      
      downloadContainer.innerHTML = `
        <h2 style="margin-top:0;margin-bottom:15px;">Download Images</h2>
        <p>Click on each link to download the corresponding page image:</p>
        <div id="download-links" style="margin:10px 0;"></div>
        <button id="download-all-btn" style="background:#4CAF50;border:none;color:white;padding:8px 16px;border-radius:4px;cursor:pointer;margin-top:10px;">
          Download All (Zip)
        </button>
        <button id="close-download-btn" style="background:#f44336;border:none;color:white;padding:8px 16px;border-radius:4px;cursor:pointer;margin-top:10px;margin-left:10px;">
          Close
        </button>
      `;
      
      document.body.appendChild(downloadContainer);
      
      const linksContainer = downloadContainer.querySelector('#download-links');
      
      // Sort extracted images by page number to ensure correct order
      extractedImages.sort((a, b) => a.pageNum - b.pageNum);
      
      // Add each image as a download link
      extractedImages.forEach((imageInfo, index) => {
        const link = document.createElement('a');
        link.href = imageInfo.src;
        link.download = `bookroll_page_${imageInfo.pageNum.toString().padStart(3, '0')}.png`;
        
        // Mark fallback images
        const isFallback = imageInfo.isFallback ? ' (fallback)' : '';
        link.textContent = `Page ${imageInfo.pageNum}${isFallback}`;
        
        link.style.display = 'block';
        link.style.margin = '5px 0';
        link.style.color = '#2196F3';
        link.style.textDecoration = 'none';
        link.style.padding = '4px 8px';
        link.style.borderRadius = '4px';
        link.style.backgroundColor = '#f5f5f5';
        
        link.onmouseover = () => {
          link.style.backgroundColor = '#e0e0e0';
        };
        
        link.onmouseout = () => {
          link.style.backgroundColor = '#f5f5f5';
        };
        
        linksContainer.appendChild(link);
      });
      
      // Handle zip download (using JSZip if available)
      const downloadAllBtn = downloadContainer.querySelector('#download-all-btn');
      downloadAllBtn.addEventListener('click', async () => {
        if (typeof JSZip === 'undefined') {
          // Load JSZip library if not available
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
          script.onload = createZip;
          script.onerror = () => {
            alert('Could not load JSZip library. Please download images individually.');
          };
          document.head.appendChild(script);
        } else {
          createZip();
        }

        async function createZip() {
            downloadAllBtn.textContent = 'Creating ZIP...';
            downloadAllBtn.disabled = true;
            
            const zip = new JSZip();
            
            // Add each image to the zip with proper binary processing
            for (let i = 0; i < extractedImages.length; i++) {
              const imageInfo = extractedImages[i];
              const pageNum = imageInfo.pageNum;
              const filename = `page_${pageNum.toString().padStart(3, '0')}.png`;
              
              try {
                if (imageInfo.src.startsWith('data:')) {
                  // Extract and process the base64 data with mathematical validation
                  const dataUrlRegex = /^data:([^;]+);base64,(.+)$/;
                  const matches = imageInfo.src.match(dataUrlRegex);
                  
                  if (!matches || matches.length !== 3) {
                    throw new Error("Malformed data URL structure");
                  }
                  
                  let base64Data = matches[2];
                  
                  // Ensure mathematical validity: base64 length must be multiple of 4
                  // Add padding if necessary according to RFC 4648
                  const paddingNeeded = (4 - (base64Data.length % 4)) % 4;
                  if (paddingNeeded > 0) {
                    base64Data += '='.repeat(paddingNeeded);
                  }
                  
                  // Convert to binary array for reliable processing
                  try {
                    const binaryString = atob(base64Data);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let j = 0; j < binaryString.length; j++) {
                      bytes[j] = binaryString.charCodeAt(j);
                    }
                    zip.file(filename, bytes.buffer);
                  } catch (decodeError) {
                    // Handle binary conversion errors gracefully
                    log(`Binary conversion error for page ${pageNum}: ${decodeError.message}`);
                    
                    // Use a more robust direct blob approach as fallback
                    const response = await fetch(imageInfo.src);
                    const blob = await response.blob();
                    zip.file(filename, blob);
                  }
                } else {
                  // For regular URLs, use direct blob fetching
                  const response = await fetch(imageInfo.src);
                  const blob = await response.blob();
                  zip.file(filename, blob);
                }
                
                downloadAllBtn.textContent = `Creating ZIP... ${i+1}/${extractedImages.length}`;
              } catch (error) {
                log(`Error processing page ${pageNum}: ${error.message}`);
                
                // Create a structured error placeholder image
                const canvas = document.createElement('canvas');
                canvas.width = 800;
                canvas.height = 600;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.font = 'bold 24px Arial';
                ctx.fillStyle = '#cc0000';
                ctx.textAlign = 'center';
                ctx.fillText(`Error Processing Page ${pageNum}`, canvas.width/2, canvas.height/2);
                
                // Add the placeholder to the ZIP
                const placeholderBlob = await new Promise(resolve => {
                  canvas.toBlob(resolve, 'image/png');
                });
                zip.file(filename, placeholderBlob);
              }
            }
            
            try {
              // Generate with optimized compression parameters
              const zipBlob = await zip.generateAsync({ 
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 6 }
              });
              
              // Create download link
              const downloadLink = document.createElement('a');
              downloadLink.href = URL.createObjectURL(zipBlob);
              downloadLink.download = 'bookroll_pages.zip';
              document.body.appendChild(downloadLink);
              downloadLink.click();
              document.body.removeChild(downloadLink);
              
              downloadAllBtn.textContent = 'Download Completed!';
            } catch (error) {
              console.error('Error creating ZIP:', error);
              downloadAllBtn.textContent = 'Error Creating ZIP';
              
              // Implement alternative download method
              createIndividualDownloads();
            }
          }
          
          // Fallback to individual files if ZIP creation fails
          function createIndividualDownloads() {
            const individualDownloadsDiv = document.createElement('div');
            individualDownloadsDiv.style.marginTop = '15px';
            individualDownloadsDiv.innerHTML = '<p>ZIP creation failed. Download individual images:</p>';
            
            const buttonGrid = document.createElement('div');
            buttonGrid.style.display = 'grid';
            buttonGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
            buttonGrid.style.gap = '8px';
            
            extractedImages.forEach(img => {
              const btn = document.createElement('a');
              btn.href = img.src;
              btn.download = `page_${img.pageNum.toString().padStart(3, '0')}.png`;
              btn.textContent = `Page ${img.pageNum}`;
              btn.style.display = 'block';
              btn.style.padding = '8px';
              btn.style.backgroundColor = '#e0e0e0';
              btn.style.textAlign = 'center';
              btn.style.borderRadius = '4px';
              buttonGrid.appendChild(btn);
            });
            
            individualDownloadsDiv.appendChild(buttonGrid);
            downloadContainer.appendChild(individualDownloadsDiv);
          }
      });
      
      // Close download dialog
      const closeDownloadBtn = downloadContainer.querySelector('#close-download-btn');
      closeDownloadBtn.addEventListener('click', () => {
        document.body.removeChild(downloadContainer);
      });
      
      statusEl.textContent = "Download ready";
    }
    
    // Set up event listeners
    analyzeBtn.addEventListener('click', analyzeStructure);
    extractBtn.addEventListener('click', extractAllPages);
    downloadBtn.addEventListener('click', downloadImages);
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      document.body.removeChild(ui);
    });
    
    log("BookRoll PDF Extractor ready. Click 'Analyze Structure' to begin.");
  })();
