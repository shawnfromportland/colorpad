import localforage from 'localforage';
import { Color, ColorpadDoc } from './types';


// initial state document
const colorpadDoc: ColorpadDoc = {
    body: "paste text, begin transcribing, or begin typing notes here...",
    colors: [
        {
            id: 1,
            value: '#003049',
            name: 'Prussian blue',
            order: 1
        },
        {
            id: 2,
            value: '#d62828',
            name: 'Fire engine red',
            order: 2
        },
        {
            id: 3,
            value: '#f77f00',
            name: 'Orange (wheel)',
            order: 3
        },
        {
            id: 4,
            value: '#fcbf49',
            name: 'Xanthous',
            order: 4
        },
        {
            id: 5,
            value: '#eae2b7',
            name: 'Vanilla',
            order: 5
        }
    ],
    settings: {
      theme: "dark",
      fontSize: 14,
      lineHeight: 1.5,
      margins: 2
    },

  };

// main interactive HTML elements for logic in this script
var contextMenu:HTMLElement|null = null;
var mainEditor:HTMLElement|null = null;
var tabContainer:HTMLElement|null = null;
var closeCitations:HTMLElement|null = null;

var citationView:HTMLElement|null = null;
var lineSpacingSlider:HTMLInputElement | null = null;
var textSizeSlider:HTMLInputElement | null = null;
var paddingSlider:HTMLInputElement | null = null;

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
    styles += '}\n';

    // Generate CSS rules for each color ID using the CSS variables
    for (const color of colors) {
        styles += `[data-color-id="${color.id}"] { background-color: var(--color-${color.id}); }\n`;
    }

    // Add the rules to the style element
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
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
    
}

// display citation view
function displayCitationView(color: Color) {
    console.log('Displaying citation view for color:', color);
    const citationView = document.getElementById('citation-view');
    const mainEditor = document.getElementById('maineditor');
    const closeCitations = document.getElementById('close-citations');

    if (citationView && mainEditor) {
        citationView.innerHTML = ''; // Clear existing content

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
            copyButton.textContent = 'Copy';
            copyButton.addEventListener('click', (event) => {
                event.stopPropagation(); // Prevent event propagation
                navigator.clipboard.writeText(span.textContent || '');
                console.log('Copied text:', span.textContent);
            });

            // Create go to button
            const goToButton = document.createElement('button');
            goToButton.classList.add('goto-button');
            goToButton.textContent = 'Go to';
            goToButton.addEventListener('click', () => {
                hideCitationView();
                const originalSpan = mainEditor.querySelector(`span[data-color-id="${color.id}"]`);
                if (originalSpan) {
                    originalSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });

            // Append buttons to the citation span
            citationSpan.appendChild(copyButton);
            citationSpan.appendChild(goToButton);

            citationView.appendChild(citationSpan);
        });

        mainEditor.style.visibility = 'hidden';
        mainEditor.style.display = 'none';
        citationView.classList.add('visible');
        citationView.style.visibility = 'visible';
        citationView.style.display = 'block';
       
        if (closeCitations) {
            closeCitations.style.display = 'block';
        } else {
            console.error('Close citations element not found');
        }
    } else {
        console.error('Citation view or main editor element not found');
    }
}

// hide citation view
function hideCitationView() {
    const citationView = document.getElementById('citation-view');
    const mainEditor = document.getElementById('maineditor');
    const closeCitations = document.getElementById('close-citations');

    if (citationView && mainEditor && closeCitations) {
        citationView.classList.remove('visible');
        mainEditor.style.visibility = 'visible';
        mainEditor.style.display = 'block';
        closeCitations.style.display = 'none';
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
    if (tabContainer) {
        tabContainer.innerHTML = ''; // Clear existing content

        colors.forEach(color => {
            if (isColorUsed(color.id)) { // Only create tab if color is used
                const tab = document.createElement('div');
                tab.className = 'color-tab';
                tab.style.backgroundColor = `var(--color-${color.id})`;

                tab.addEventListener('click', () => {
                    displayCitationView(color);
                });

                tabContainer?.appendChild(tab);
            }
        });
    } else {
        console.error('Tab container element not found');
    }
}

//DOM LOAD:
document.addEventListener('DOMContentLoaded',async () => {
    
    // load references to the main UI elements
    contextMenu = document.getElementById('hovermenu');
    mainEditor = document.getElementById('maineditor');
    tabContainer = document.getElementById('tab-navigation');
    closeCitations = document.getElementById('close-citations');

    citationView = document.getElementById('citation-view') as HTMLElement;
    lineSpacingSlider = document.getElementById('line-spacing-slider') as HTMLInputElement;
    textSizeSlider = document.getElementById('text-size-slider') as HTMLInputElement;
    paddingSlider = document.getElementById('padding-slider') as HTMLInputElement;

    
    closeCitations?.addEventListener('click', hideCitationView);

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
    });

    // Add event listener to hide context menu when clicking close button
    citationView?.addEventListener('click', hideCitationView);

    // padding slider event listener
    paddingSlider.addEventListener('input', (event) => {
      const paddingValue = (event.target as HTMLInputElement).value + 'rem';
      (mainEditor as HTMLInputElement).style.paddingLeft = paddingValue;
      (mainEditor as HTMLInputElement).style.paddingRight = paddingValue;
      const citationView = document.getElementById('citation-view') as HTMLInputElement;
      citationView.style.paddingLeft = paddingValue;
      citationView.style.paddingRight = paddingValue;
    });

    // line spacing slider event listener
    lineSpacingSlider.addEventListener('input', (event) => {
        const value = (event.target as HTMLInputElement).value;
        document.documentElement.style.setProperty('--line-spacing', value);
    });

    // text size slider event listener
    textSizeSlider.addEventListener('input', (event) => {
        const value = (event.target as HTMLInputElement).value;
        document.documentElement.style.setProperty('--text-size', `${value}rem`);
    });

});

