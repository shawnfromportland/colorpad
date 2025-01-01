import localforage from 'localforage';
import { Color, ColorpadDoc } from './types';


// initial state document
const colorpadDoc: ColorpadDoc = {
    body: "paste text, begin transcribing, or begin typing notes here...",
    colors: [
        {
            id: 1,
            value: '#5ebd3e',
            name: 'Kelly green',
            order: 1
        },
        {
            id: 2,
            value: '#ffb900',
            name: 'Selective yellow',
            order: 2
        },
        {
            id: 3,
            value: '#f78200',
            name: 'UT orange',
            order: 3
        },
        {
            id: 4,
            value: '#e23838',
            name: 'Imperial red',
            order: 4
        },
        {
            id: 5,
            value: '#973999',
            name: 'Plum',
            order: 5
        },
        {
            id: 6,
            value: '#009cdf',
            name: 'Celestial Blue',
            order: 6
        }
    ],
    settings: {
      theme: "dark",
      fontSize: 1.4,
      lineHeight: 1.5,
      margins: 2,
      pinnedLineSpacing: true,
      pinnedTextSize: true,
      pinnedPadding: true
    },
};

// main interactive HTML elements for logic in this script
var contextMenu:HTMLElement|null = null;
var mainEditor:HTMLElement|null = null;
var tabContainer:HTMLElement|null = null;

var citationView:HTMLElement|null = null;
var lineSpacingSlider:HTMLInputElement | null = null;
var textSizeSlider:HTMLInputElement | null = null;
var paddingSlider:HTMLInputElement | null = null;

var settingsView: HTMLElement | null = null;
var settingsTab: HTMLElement | null = null;

let typingTimeout: number | undefined;

// set editor contents to colorpadDoc body
async function updateEditor(): Promise<void> {
    if (mainEditor) {
        const selection = window.getSelection();
        const range = document.createRange();
        const cursorPosition = selection?.getRangeAt(0).startOffset || 0;

        mainEditor.innerHTML = colorpadDoc.body; // Use innerHTML to render HTML tags

        range.setStart(mainEditor.childNodes[0], cursorPosition);
        range.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(range);
    }
}

// set colorpad.body to editor contents (after changes)
function updateCurrentColorpadDocFromInput() {
    console.log('updateCurrentColorpadDocFromInput');
    if (mainEditor) {
        colorpadDoc.body = mainEditor.innerHTML;
    }
}



// Function to generate and update CSS variables for colors
function updateDynamicStyles(colors:Color[]) {
    // Remove old styles if they exist
    let styleElement = document.getElementById('dynamic-styles');
    if (styleElement) {
        styleElement.remove();
    }

    // Create a new style element
    styleElement = document.createElement('style');
    styleElement.id = 'dynamic-styles';

    // Generate CSS rules for each color ID
    let styles = '';


    // Define CSS variables for each color
    styles += ':root {\n';
    for (const color of colors) {
        styles += `    --color-${color.id}: ${color.value};\n`;
    }
    styles += `    --line-spacing: ${colorpadDoc.settings.lineHeight};\n`;
    styles += `    --text-size: ${colorpadDoc.settings.fontSize}rem;\n`;
    styles += `    --margins: ${colorpadDoc.settings.margins}rem;\n`;
    styles += '}\n';

    // Generate CSS rules for each color ID using the CSS variables
    for (const color of colors) {
        styles += `[data-color-id="${color.id}"] { background-color: var(--color-${color.id}); }\n`;
    }


    

    // Add the rules to the style element
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
}

// Function to adjust text color based on background brightness
function adjustTextColor(hex: string): string {
    if (hex.indexOf('#') === 0) {
        hex = hex.slice(1);
    }
    // Convert 3-digit hex to 6-digit hex
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length !== 6) {
        throw new Error('Invalid HEX color.');
    }
    const r = parseInt(hex.slice(0, 2), 16),
          g = parseInt(hex.slice(2, 4), 16),
          b = parseInt(hex.slice(4, 6), 16);
    // Calculate brightness
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    // Invert color components
    const invertedR = (255 - r),
          invertedG = (255 - g),
          invertedB = (255 - b);
    // Adjust text color based on brightness
    if (brightness > 128) {
        // Subdued shade for lighter backgrounds
        return `rgb(${Math.floor(invertedR * 0.7)}, ${Math.floor(invertedG * 0.7)}, ${Math.floor(invertedB * 0.7)})`;
    } else {
        // Pastel shade for darker backgrounds
        return `rgb(${Math.floor(invertedR + (255 - invertedR) * 0.5)}, ${Math.floor(invertedG + (255 - invertedG) * 0.5)}, ${Math.floor(invertedB + (255 - invertedB) * 0.5)})`;
    }
}

// highlight current text selection with color
function highlightText(color: Color) {
    console.log("highlighttext with color ", color);
    if (color) {
        // Update the order of the colors
        colorpadDoc.colors.forEach(c => {
            if (c.id === color.id) {
                c.order = 1;
            } else if (c.order < color.order) {
                c.order += 1;
            }
        });

        // Check if the color is already in the array
        const existingColor = colorpadDoc.colors.find(c => c.id === color.id);
        if (!existingColor) {
            // Add the new color to the array
            colorpadDoc.colors.push(color);
        }

        // Sort the colors by their new order
        colorpadDoc.colors.sort((a, b) => a.order - b.order);
    }

    if (contextMenu) {
        contextMenu.classList.remove('visible');
    }

    // Apply the 'highlighted' class to the selected text
    const selection = window.getSelection();
    console.log('selection and rangecount!', selection, selection?.rangeCount);
    if (selection && selection.rangeCount > 0) {
        console.log('selection and rangecount!', selection, selection.rangeCount);
        const range = selection.getRangeAt(0);
        const selectedText = range.toString();

        if (selectedText.trim().length > 0) { // Ensure non-empty selection
            console.log('selected text', selectedText);

            // Create the <span> element with the custom attribute
            const wrapper = document.createElement('span');
            wrapper.setAttribute('data-color-id', '' + color.id);
            wrapper.setAttribute('class', 'highlighted');

            // Set the content of the <span>, preserving spaces
            wrapper.textContent = selectedText
                .replace(/^ /, '\u00A0') // Replace leading space with non-breaking space
                .replace(/ $/, '\u00A0'); // Replace trailing space with non-breaking space

            // Set the background color and calculate the adjusted text color
            wrapper.style.backgroundColor = color.value;
            wrapper.style.color = adjustTextColor(color.value);

            // Replace the selected range with the <span>
            range.deleteContents();
            console.log('After modification:', document.activeElement);
            range.insertNode(wrapper);
            console.log('After modification:', document.activeElement);
            colorpadDoc.body = mainEditor?.innerHTML || '';
            // Clear the selection to avoid visual confusion
            selection.removeAllRanges();
            console.log('selection cleared');
        }
    }
    saveColorpadDoc(); // Save after highlighting text
}

// generate list of available highlight colors in selection context menu
function populateContextMenu(colorDefinitions: Color[]) {
    console.log('Populating context menu with colors:', colorDefinitions);
    // Clear existing options
    const colormenu = document.getElementById('hovermenu') as HTMLSelectElement;
    if (!colormenu) {
        console.error('Hover menu element not found');
        return;
    }
    colormenu.innerHTML = '';
    const removeButton = document.createElement('span');
    removeButton.innerText = 'ⓧ';
    removeButton.className = 'highlightbutton';
    removeButton.id='removehilite';
    removeButton.addEventListener('click', () => console.log('removehilite'));
    colormenu.appendChild(removeButton);

    // Add new options based on colorDefinitions
    for (const color of colorDefinitions) {
        const span = document.createElement('span');
        span.className = 'highlightbutton';
        span.style.backgroundColor = `var(--color-${color.id})`;
        span.addEventListener('mousedown', (e) => { e.preventDefault(); highlightText(color); });
        colormenu.appendChild(span);
    }
}

// Function to save colorpadDoc to localforage
async function saveColorpadDoc(): Promise<void> {
    try {
        const resultingColorpadDoc = await localforage.setItem('colorpadDoc', colorpadDoc);
        // This code runs once the value has been loaded
        // from the offline store.
        console.log('saved doc: ',resultingColorpadDoc);
        
        reactivityUpdates();
    } catch (err) {
        // This code runs if there were any errors.
        console.log(err);
    }
}

// perform UI updates upon data changes
function reactivityUpdates(){
    console.log('reactivity updates');
    
    //initial update
    updateDynamicStyles(colorpadDoc.colors);
    populateContextMenu(colorpadDoc.colors);
    createTabNavigation(colorpadDoc.colors); // Add this line
    updateSliderVisibility();
    
}

// Function to show copy notification
function showCopyNotification(event: MouseEvent, message: string = 'Text copied!') {
    const notification = document.createElement('div');
    notification.className = 'copy-notification';
    notification.textContent = message;
    document.body.appendChild(notification);

    const { clientX: x, clientY: y } = event;
    notification.style.left = `${x}px`;
    notification.style.top = `${y}px`;

    requestAnimationFrame(() => {
        notification.classList.add('visible');
    });

    setTimeout(() => {
        notification.classList.remove('visible');
        setTimeout(() => {
            notification.remove();
        }, 500);
    }, 500);
}

// display citation view
function displayCitationView(color: Color) {
    console.log('Displaying citation view for color:', color);
    mainEditor = document.getElementById('maineditor');
    citationView = document.getElementById('citation-view');
    
    if (citationView instanceof HTMLElement && mainEditor) {
        citationView.innerHTML = ''; // Clear existing content

        // Add color info section
        const colorInfo = document.createElement('div');
        colorInfo.id = 'color-info';

        const colorCircle = document.createElement('div');
        colorCircle.id = 'color-circle';
        colorCircle.style.backgroundColor = color.value;

        const colorNameInput = document.createElement('input');
        colorNameInput.id = 'color-name-input';
        colorNameInput.value = color.name;
        colorNameInput.addEventListener('input', (event) => {
            color.name = (event.target as HTMLInputElement).value;
            saveColorpadDoc();
        });

        const copyJsonButton = document.createElement('button');
        copyJsonButton.id = 'copy-json-button';
        copyJsonButton.textContent = '📄 COPY JSON';
        copyJsonButton.classList.add('copy-json-button');
        copyJsonButton.addEventListener('click', (event) => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(mainEditor?.innerHTML || '', 'text/html');
            const spans = doc.querySelectorAll(`span[data-color-id="${color.id}"]`);
            const citations = Array.from(spans).map(span => span.textContent?.trim()).filter(Boolean);
            const jsonData = { [color.name]: citations };
            navigator.clipboard.writeText(JSON.stringify(jsonData, null, 2));
            console.log('Copied JSON:', jsonData);
            showCopyNotification(event, 'JSON copied!');
        });

        colorInfo.appendChild(colorCircle);
        colorInfo.appendChild(colorNameInput);
        colorInfo.appendChild(copyJsonButton);
        citationView.appendChild(colorInfo);

        const parser = new DOMParser();
        const doc = parser.parseFromString(mainEditor.innerHTML, 'text/html');
        const spans = doc.querySelectorAll(`span[data-color-id="${color.id}"]`);

        spans.forEach(span => {
            const citationSpan = document.createElement('span');
            citationSpan.className = 'citation-highlight';
            citationSpan.textContent = span.textContent;

            // Create copy button
            const copyButton = document.createElement('button');
            copyButton.classList.add('copy-button');
            copyButton.textContent = '📄';
            copyButton.addEventListener('click', (event) => {
                event.stopPropagation(); // Prevent event propagation
                navigator.clipboard.writeText(span.textContent || '');
                console.log('Copied text:', span.textContent);
                showCopyNotification(event);
            });

            // Append the copy button to the citation span
            citationSpan.appendChild(copyButton);

            // Add event listener to scroll to the original span when clicked
            citationSpan.addEventListener('click', () => {
                console.log('Scrolling to original span');
                hideCitationView();
                const originalSpan = mainEditor?.querySelector(`span[data-color-id="${color.id}"]`);
                if (originalSpan) {
                    originalSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
            
            citationView?.appendChild(citationSpan);
            
        });
        
        console.log('making citationview visible!');
        requestAnimationFrame(() => {
            citationView?.classList.add('visible');
        });
        console.log('citationview classlist', citationView.classList);
    } else {
        console.error('Citation view or main editor element not found');
    }
}

// hide citation view
function hideCitationView() {
    if (citationView) {
        citationView.classList.remove('visible');
    }
}

// check if a color is used in the colorpadDoc body
function isColorUsed(colorId: number): boolean {
   
    if (mainEditor) {
        //console.log('colorpadDoc.body', colorpadDoc.body);
        // search colorpadDoc.body for matching spans:
        const parser = new DOMParser();
        const doc = parser.parseFromString(colorpadDoc.body, 'text/html');
        const spans = doc.querySelectorAll(`span[data-color-id="${colorId}"]`);

        // const spans = mainEditor?.querySelectorAll(`span[data-color-id="${colorId}"]`) || [];
        // console.log('spans',spans);
        return spans.length > 0;
    }
    return false;
}

// render the colored tab navigation when updates are needed
function createTabNavigation(colors: Color[]) {
    console.log('Creating tab navigation with colors:', colors);
    const colorTabHolder = document.createElement('div');
    colorTabHolder.id = 'colortab-holder';
    if (tabContainer) {
        tabContainer.innerHTML = ''; // Clear existing content
        tabContainer.appendChild(colorTabHolder); // Add the color tab holder

        colors.forEach(color => {
            if (isColorUsed(color.id)) { // Only create tab if color is used
                const tab = document.createElement('div');
                //add alt text for color.name
                tab.title = color.name;
                tab.className = 'color-tab';
                tab.style.backgroundColor = `var(--color-${color.id})`;

                tab.addEventListener('click', () => {
                    displayCitationView(color);
                });

                colorTabHolder.appendChild(tab);
            }
        });

        // Ensure the settings tab is always the last element
       if(settingsTab) tabContainer.appendChild(settingsTab);
    } else {
        console.error('Tab container element not found');
    }
}

// Function to sync slider values between pinned sliders and settings view sliders
function syncSliderValues() {
    if (lineSpacingSlider) {
        const settingsLineSpacingSlider = document.getElementById('settings-line-spacing-slider') as HTMLInputElement;
        if (settingsLineSpacingSlider) {
            settingsLineSpacingSlider.value = lineSpacingSlider.value;
        }
    }
    if (textSizeSlider) {
        const settingsTextSizeSlider = document.getElementById('settings-text-size-slider') as HTMLInputElement;
        if (settingsTextSizeSlider) {
            settingsTextSizeSlider.value = textSizeSlider.value;
        }
    }
    if (paddingSlider) {
        const settingsPaddingSlider = document.getElementById('settings-padding-slider') as HTMLInputElement;
        if (settingsPaddingSlider) {
            settingsPaddingSlider.value = paddingSlider.value;
        }
    }
    
    // saveColorpadDoc();
}

// Function to update the visibility of sliders based on pinned settings
function updateSliderVisibility() {
    const lineSpacingSliderContainer = document.getElementById('line-spacing-slider-container');
    const textSizeSliderContainer = document.getElementById('text-size-slider-container');
    const paddingSliderContainer = document.getElementById('padding-slider-container');

    if (lineSpacingSliderContainer) {
        lineSpacingSliderContainer.style.display = colorpadDoc.settings.pinnedLineSpacing ? 'block' : 'none';
    }
    if (textSizeSliderContainer) {
        textSizeSliderContainer.style.display = colorpadDoc.settings.pinnedTextSize ? 'block' : 'none';
    }
    if (paddingSliderContainer) {
        paddingSliderContainer.style.display = colorpadDoc.settings.pinnedPadding ? 'block' : 'none';
    }
    // Sync initial slider values with colorpadDoc settings
    const settingsLineSpacingSlider = document.getElementById('settings-line-spacing-slider') as HTMLInputElement;
    const settingsTextSizeSlider = document.getElementById('settings-text-size-slider') as HTMLInputElement;
    const settingsPaddingSlider = document.getElementById('settings-padding-slider') as HTMLInputElement;
    lineSpacingSlider = document.getElementById('line-spacing-slider') as HTMLInputElement;
    textSizeSlider = document.getElementById('text-size-slider') as HTMLInputElement;
    paddingSlider = document.getElementById('padding-slider') as HTMLInputElement;

    if (settingsLineSpacingSlider) {
        settingsLineSpacingSlider.value = colorpadDoc.settings.lineHeight.toString();
    }
    if (settingsTextSizeSlider) {
        settingsTextSizeSlider.value = colorpadDoc.settings.fontSize.toString();
    }
    if (settingsPaddingSlider) {
        settingsPaddingSlider.value = colorpadDoc.settings.margins.toString();
    }
    if (lineSpacingSlider) {
        lineSpacingSlider.value = colorpadDoc.settings.lineHeight.toString();
    }
    if (textSizeSlider) {
        textSizeSlider.value = colorpadDoc.settings.fontSize.toString();
    }
    if (paddingSlider) {
        paddingSlider.value = colorpadDoc.settings.margins.toString();
    }
    syncSliderValues(); // Sync slider values after updating visibility
}

// Function to toggle the visibility of the settings view
function toggleSettingsView() {
    if (settingsView) {
        if (settingsView.style.display === 'none' || settingsView.style.display === '') {
            settingsView.style.display = 'block';
            settingsView.style.visibility = 'visible';
        } else {
            settingsView.style.display = 'none';
            settingsView.style.visibility = 'hidden';
        }
    }
}

// Function to toggle pinning of sliders
function togglePinning(settingKey: keyof ColorpadDoc['settings']) {
    colorpadDoc.settings[settingKey] = !colorpadDoc.settings[settingKey];
    saveColorpadDoc();
    updateSliderVisibility();
}

// Function to copy all highlights to JSON
function copyAllHighlightsToJson(event: MouseEvent) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(mainEditor?.innerHTML || '', 'text/html');
    const jsonData: { [key: string]: string[] } = {};

    colorpadDoc.colors.forEach(color => {
        const spans = doc.querySelectorAll(`span[data-color-id="${color.id}"]`);
        const citations = Array.from(spans).map(span => span.textContent?.trim()).filter(Boolean);
        if (citations.length > 0) {
            jsonData[color.name] = citations;
        }
    });

    navigator.clipboard.writeText(JSON.stringify(jsonData, null, 2));
    console.log('Copied All Highlights JSON:', jsonData);
    showCopyNotification(event, 'All Highlights JSON copied!');
}

// Function to toggle pinning of the copy-all-json button
function togglePinCopyAllJson() {
    const copyAllJsonButton = document.getElementById('copy-all-json-button');
    const settingsCopyAllJsonButton = document.getElementById('settings-copy-all-json-button');
    const isPinned = copyAllJsonButton?.style.display !== 'none';

    if (isPinned) {
        copyAllJsonButton!.style.display = 'none';
    } else {
        copyAllJsonButton!.style.display = 'block';
    }

    saveColorpadDoc();
}

//DOM LOAD:
document.addEventListener('DOMContentLoaded',async () => {
    
    // load references to the main UI elements
    contextMenu = document.getElementById('hovermenu');
    mainEditor = document.getElementById('maineditor');
    tabContainer = document.getElementById('tab-navigation');

    citationView = document.getElementById('citation-view');
    lineSpacingSlider = document.getElementById('line-spacing-slider') as HTMLInputElement;
    textSizeSlider = document.getElementById('text-size-slider') as HTMLInputElement;
    paddingSlider = document.getElementById('padding-slider') as HTMLInputElement;

    settingsView = document.getElementById('settings-view');
    settingsTab = document.getElementById('settings-tab');

    settingsTab?.addEventListener('click', toggleSettingsView);

    document.getElementById('pin-line-spacing')?.addEventListener('click', () => togglePinning('pinnedLineSpacing'));
    document.getElementById('pin-text-size')?.addEventListener('click', () => togglePinning('pinnedTextSize'));
    document.getElementById('pin-padding')?.addEventListener('click', () => togglePinning('pinnedPadding'));

    updateSliderVisibility();
    

    // Check if colorpadDoc exists in localForage, if not, create it
    // with data loaded, update the UI
    await localforage.getItem<ColorpadDoc>('colorpadDoc').then(async (storedDoc) => {
        if(storedDoc){
            // If colorpadDoc exists, use the stored version
            console.log('Loaded colorpadDoc:', storedDoc);
            // You can update your app's state here with the loaded document
            colorpadDoc.body = storedDoc.body;
            colorpadDoc.colors = storedDoc.colors;
            colorpadDoc.settings = storedDoc.settings;
        }
        else{
            await saveColorpadDoc(); // Save the default colorpadDoc
        }
        
        if(mainEditor){mainEditor.innerHTML = colorpadDoc.body; }
           
        
    }).catch((err) => {
        console.error('Error reading colorpadDoc:', err);
    })
    .then(() => {
        reactivityUpdates(); // Ensure reactivity updates are called
    });

    
    // Add event listener for the context menu
    mainEditor?.addEventListener('mouseup', function (event) {
        setTimeout(() => {
            const selection = window.getSelection();
            console.log('Selection valid?', selection);

            if (contextMenu && selection && selection.toString().trim().length > 0) {
                console.log('Showing context menu');
                contextMenu.classList.add('visible');
                contextMenu.style.top = `${event.clientY - parseFloat(getComputedStyle(mainEditor as HTMLElement).lineHeight)}px`;
                contextMenu.style.left = `${event.clientX}px`;
                contextMenu.style.display = 'block';
            } else {
                console.log('Hiding context menu');
                if(contextMenu){
                    contextMenu.classList.remove('visible');
                }
            }
        }, 0);
    });

    // Add event listener for the paste action
    mainEditor?.addEventListener('paste', function (event) {
        event.preventDefault();
        // Get plain text from the clipboard
        const plainText = event.clipboardData?.getData('text/plain');

        // Insert the plain text at the caret position
        const selection = window.getSelection();
        if (!selection?.rangeCount) return;

        const range = selection.getRangeAt(0);
        range.deleteContents(); // Remove any selected content
        range.insertNode(document.createTextNode(plainText ?? ""));

        // Move the cursor to the end of the inserted text
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);

        updateCurrentColorpadDocFromInput();
        saveColorpadDoc(); // Save after paste operation
    });

    // typing debounced save
    mainEditor?.addEventListener('input', function () {
        console.log('typing input listener')
        if (typingTimeout) {
            clearTimeout(typingTimeout);
        }
        typingTimeout = window.setTimeout(() => {
            updateCurrentColorpadDocFromInput();
            saveColorpadDoc(); // Save after 200ms debounce on typing
        }, 200);
    });

    // Add event listener to hide context menu when clicking outside
    document.addEventListener('click', (event) => {
        console.log('click event', event);
        const target = event.target as HTMLElement;
        if (mainEditor && contextMenu && !contextMenu.contains(target) && !mainEditor.contains(target)) {
            contextMenu.classList.remove('visible');
        }
        
        console.log('testing citationview click ');
        if ( !target.closest('.citation-highlight')) {
            console.log('hiding citation view ');
            hideCitationView();
        }
    });

    // padding slider event listener
    paddingSlider.addEventListener('input', (event) => {
      const paddingValue = (event.target as HTMLInputElement).value + 'rem';
      (mainEditor as HTMLInputElement).style.paddingLeft = paddingValue;
      (mainEditor as HTMLInputElement).style.paddingRight = paddingValue;
      (citationView as HTMLElement).style.paddingLeft = paddingValue;
      (citationView as HTMLElement).style.paddingRight = paddingValue;
      document.documentElement.style.setProperty('--margins', paddingValue);
      colorpadDoc.settings.margins = parseFloat((event.target as HTMLInputElement).value);
      saveColorpadDoc();
    });

    // line spacing slider event listener
    lineSpacingSlider.addEventListener('input', (event) => {
        const value = (event.target as HTMLInputElement).value;
        document.documentElement.style.setProperty('--line-spacing', value);
        colorpadDoc.settings.lineHeight = parseFloat(value);
        saveColorpadDoc();
    });

    // text size slider event listener
    textSizeSlider.addEventListener('input', (event) => {
        const value = (event.target as HTMLInputElement).value;
        document.documentElement.style.setProperty('--text-size', `${value}rem`);
        colorpadDoc.settings.fontSize = parseFloat(value);
        saveColorpadDoc();
    });

    // Add event listeners for the settings view sliders
    const settingsLineSpacingSlider = document.getElementById('settings-line-spacing-slider') as HTMLInputElement;
    const settingsTextSizeSlider = document.getElementById('settings-text-size-slider') as HTMLInputElement;
    const settingsPaddingSlider = document.getElementById('settings-padding-slider') as HTMLInputElement;

    settingsLineSpacingSlider?.addEventListener('input', (event) => {
        const value = (event.target as HTMLInputElement).value;
        document.documentElement.style.setProperty('--line-spacing', value);
        lineSpacingSlider!.value = value; // Sync with pinned slider
        colorpadDoc.settings.lineHeight = parseFloat(value);
        saveColorpadDoc();
        updateDynamicStyles
    });

    settingsTextSizeSlider?.addEventListener('input', (event) => {
        const value = (event.target as HTMLInputElement).value;
        document.documentElement.style.setProperty('--text-size', `${value}rem`);
        textSizeSlider!.value = value; // Sync with pinned slider
        colorpadDoc.settings.fontSize = parseFloat(value);
        saveColorpadDoc();
    });
    

    settingsPaddingSlider?.addEventListener('input', (event) => {
        const paddingValue = (event.target as HTMLInputElement).value + 'rem';
        mainEditor!.style.paddingLeft = paddingValue;
        mainEditor!.style.paddingRight = paddingValue;
        (citationView as HTMLElement).style.paddingLeft = paddingValue;
        (citationView as HTMLElement).style.paddingRight = paddingValue;
        paddingSlider!.value = (event.target as HTMLInputElement).value; // Sync with pinned slider
        colorpadDoc.settings.margins = parseFloat((event.target as HTMLInputElement).value);
        saveColorpadDoc();
    });

    const copyAllJsonButton = document.getElementById('copy-all-json-button');
    const settingsCopyAllJsonButton = document.getElementById('settings-copy-all-json-button');
    const pinCopyAllJsonButton = document.getElementById('pin-copy-all-json');

    copyAllJsonButton?.addEventListener('click', copyAllHighlightsToJson);
    settingsCopyAllJsonButton?.addEventListener('click', copyAllHighlightsToJson);
    pinCopyAllJsonButton?.addEventListener('click', togglePinCopyAllJson);

    // Initialize the visibility of the copy-all-json button based on settings
    if (colorpadDoc.settings.pinnedCopyAllJson) {
        copyAllJsonButton!.style.display = 'block';
    } else {
        copyAllJsonButton!.style.display = 'none';
    }

    updateSliderVisibility();
});

