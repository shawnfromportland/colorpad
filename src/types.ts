
export type Color = {
    id: number; // Unique identifier for the color
    value: string; // Color value, e.g., "#FF0000" or "red"
    name: string; // Name of the color, e.g., "Red"
    order: number; // Order of the color in the list
};

export type Settings = {
    [key: string]: any; // Key-value pair for settings; definitions to be expanded later
};

export type ColorpadDoc = {
    body: string; // Long block of text, possibly as long as a book
    colors: Color[]; // Array of color objects
    settings: Settings; // Object list of settings keys and values
};