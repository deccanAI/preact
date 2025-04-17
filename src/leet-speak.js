/**
 * Character mappings for Leet Speak conversion
 * @type {Object}
 */
const LEET_CHAR_MAP = {
	'a': '4',
	'e': '3',
	'i': '1',
	'o': '0',
	't': '7',
	'l': '1',
	's': '5',
	'g': '6',
	'z': '2'
};

/**
 * Reverse character mappings for Leet Speak decoding
 * @type {Object}
 */
const REVERSE_LEET_CHAR_MAP = Object.fromEntries(
	Object.entries(LEET_CHAR_MAP).map(([key, value]) => [value, key])
);

/**
 * Converts normal text to Leet Speak
 * @param {string} text - The text to convert to Leet Speak
 * @returns {string} The text converted to Leet Speak
 */
export function leetSpeakEncode(text) {
	if (!text || typeof text !== 'string') return text;
	
	return text.split('').map(char => {
		const lowerChar = char.toLowerCase();
		return LEET_CHAR_MAP[lowerChar] || char;
	}).join('');
}

/**
 * Converts Leet Speak back to normal text
 * @param {string} leetText - The Leet Speak text to convert back
 * @returns {string} The decoded normal text
 */
export function leetSpeakDecode(leetText) {
	if (!leetText || typeof leetText !== 'string') return leetText;
	
	return leetText.split('').map(char => {
		return REVERSE_LEET_CHAR_MAP[char] || char;
	}).join('');
}
