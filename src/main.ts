import localforage from 'localforage';

type Color = {
    id: number; // Unique identifier for the color
    value: string; // Color value, e.g., "#FF0000" or "red"
    name: string; // Name of the color, e.g., "Red"
    order: number; // Order of the color in the list
};

type Settings = {
    [key: string]: any; // Key-value pair for settings; definitions to be expanded later
};

type ColorpadDoc = {
    body: string; // Long block of text, possibly as long as a book
    colors: Color[]; // Array of color objects
    settings: Settings; // Object list of settings keys and values
};

const colorDefinitions:Color[] = [
    {
        id: 1,
        value: '#FF0000',
        name: 'Red',
        order: 1
    },
    {
        id: 2,
        value: '#00FF00',
        name: 'Green',
        order: 2
    },
    {
        id: 3,
        value: '#FFFF00',
        name: 'Yellow',
        order: 3
    }
];

const colorpadDoc: ColorpadDoc = {
    body: "paste text, begin transcribing, or begin typing notes here...",
    colors: [...colorDefinitions],
    settings: {
      theme: "dark",
      fontSize: 14,
      lineHeight: 1.5,
      margins: 2
    },

  };
  var contextMenu:HTMLElement|null = null;
  var mainEditor:HTMLElement|null = null;
  var tabContainer:HTMLElement|null = null;
//   read the first document from localForge, or save one if none exists:

//localForge Here
//localForge Here
async function updateEditor(): Promise<void> {
    if (mainEditor ) {
        mainEditor.innerHTML = colorpadDoc.body; // Use innerHTML to render HTML tags
    }
}

// Function to sync mainEditor content with colorpadDoc body
function syncEditorToDoc() {
    if (mainEditor) {
        colorpadDoc.body = mainEditor.innerHTML;
    }
}

// Check if colorpadDoc exists in localForage, if not, create it
localforage.getItem<ColorpadDoc>('colorpadDoc').then((storedDoc) => {
    if (!storedDoc) {
        // If no document exists, save the default colorpadDoc
        localforage.setItem('colorpadDoc', colorpadDoc).then(() => {
            console.log('New colorpadDoc saved');
        }).catch((err) => {
            console.error('Error saving colorpadDoc:', err);
        });
    } else {
        // If colorpadDoc exists, use the stored version
        console.log('Loaded colorpadDoc:', storedDoc);
        // You can update your app's state here with the loaded document
        colorpadDoc.body = storedDoc.body;
        colorpadDoc.colors = storedDoc.colors;
        colorpadDoc.settings = storedDoc.settings;
    }
    updateEditor();
}).catch((err) => {
    console.error('Error reading colorpadDoc:', err);
});

// Function to generate and update CSS rules
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
            // Clear the selection to avoid visual confusion
            selection.removeAllRanges();
            console.log('selection cleared');
        }
    }
    saveColorpadDoc(); // Save after highlighting text
}


function populateContextMenu(colorDefinitions:Color[]) {
    // Clear existing options
    const colormenu = document.getElementById('hovermenu') as HTMLSelectElement;
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
        span.addEventListener('mousedown', (e) => {e.preventDefault(); highlightText(color);});
        colormenu.appendChild(span);
    }

}


// Function to save colorpadDoc to localforage
async function saveColorpadDoc(): Promise<void> {
    syncEditorToDoc(); // Sync editor content before saving
    try {
        const resultingColorpadDoc = await localforage.setItem('colorpadDoc', colorpadDoc);
        // This code runs once the value has been loaded
        // from the offline store.
        console.log('saved',resultingColorpadDoc);
        
        reactivityUpdates();
    } catch (err) {
        // This code runs if there were any errors.
        console.log(err);
    }

   
}

function reactivityUpdates(){
    
    //initial update
    updateDynamicStyles(colorpadDoc.colors);
    populateContextMenu(colorpadDoc.colors);
    createTabNavigation(colorpadDoc.colors); // Add this line
}

function createTabNavigation(colors: Color[]) {
    if (tabContainer) {
        tabContainer.innerHTML = ''; // Clear existing content

        colors.forEach(color => {
            const tab = document.createElement('div');
            tab.className = 'color-tab';
            tab.style.backgroundColor = `var(--color-${color.id})`;
            

            // tab.addEventListener('mouseenter', () => {
            //     tab.style.transform = 'translateY(0)';
            // });

            // tab.addEventListener('mouseleave', () => {
            //     tab.style.transform = 'translateY(-50%)';
            // });

            tab.addEventListener('click', () => {
                console.log(`Clicked color: ${color.name}`);
            });

            tabContainer?.appendChild(tab);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {

    contextMenu = document.getElementById('hovermenu');
    mainEditor = document.getElementById('maineditor');
    tabContainer = document.getElementById('tab-navigation');
    reactivityUpdates();

    mainEditor?.addEventListener('mouseup', function (event) {
        const selection = window.getSelection();
        console.log('Selection valid?', selection);

        if (contextMenu && selection && selection.toString().length > 0) {
            // const range = selection.getRangeAt(0);
            // const rect = range.getBoundingClientRect();
            contextMenu.classList.add('visible');
            contextMenu.style.top = `${event.clientY - parseFloat(getComputedStyle(mainEditor as HTMLElement).lineHeight)}px`;
            contextMenu.style.left = `${event.clientX}px`; contextMenu.style.display = 'block';
        } else {
            if(contextMenu){
                contextMenu.classList.remove('visible');
            }
            
        }
    });

    mainEditor?.addEventListener('paste', function () {
        saveColorpadDoc(); // Save after paste operation
    });

    document.addEventListener('paste', function (event) {
        event.preventDefault();
        // Get plain text from the clipboard
        const plainText = event.clipboardData?.getData('text/plain');
  
        // Insert the plain text at the caret position
        const selection = window.getSelection();
        if (!selection?.rangeCount) return;
  
        const range = selection.getRangeAt(0);
        range.deleteContents(); // Remove any selected content
        range.insertNode(document.createTextNode(plainText??""));
  
        // Move the cursor to the end of the inserted text
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      });

    let typingTimeout: number | undefined;
    mainEditor?.addEventListener('input', function () {
        if (typingTimeout) {
            clearTimeout(typingTimeout);
        }
        typingTimeout = window.setTimeout(() => {
            saveColorpadDoc(); // Save after 200ms debounce on typing
        }, 200);
    });

    document.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        if (mainEditor && contextMenu && !contextMenu.contains(target) && !mainEditor.contains(target)) {
            contextMenu.classList.remove('visible');
        }
    });


});

