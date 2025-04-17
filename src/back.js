/**
 * Implements a back navigation method for Preact context
 * @param {string|null} alt Alternative URL to redirect to if no referrer is present
 * @returns {void}
 */
export function back(alt) {
	// Check if we're in a browser environment
	if (typeof window !== 'undefined') {
		// Get the referrer from document.referrer (standard way to access HTTP Referer header)
		const referrer = document.referrer;
		
		// If there's a referrer, navigate to it
		if (referrer) {
			window.location.href = referrer;
		} 
		// Otherwise use the alternative URL if provided
		else if (alt) {
			window.location.href = alt;
		}
		// If no alternative is provided, just use browser's history.back()
		else {
			window.history.back();
		}
	}
}

/**
 * Legacy redirect method that emits a deprecation warning when 'back' is used
 * @param {string} url URL to redirect to
 * @returns {void}
 */
export function redirect(url) {
	if (url === 'back') {
		console.warn(
			'Deprecation warning: redirect("back") is deprecated. ' +
			'Please use ctx.back() instead for better browser compatibility.'
		);
		back();
	} else if (typeof window !== 'undefined') {
		window.location.href = url;
	}
}
