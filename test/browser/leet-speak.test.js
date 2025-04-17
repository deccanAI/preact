import { expect } from 'chai';
import { leetSpeakEncode, leetSpeakDecode } from '../../src/leet-speak';

describe('Leet Speak', () => {
	describe('leetSpeakEncode', () => {
		it('should convert normal text to leet speak', () => {
			expect(leetSpeakEncode('elite')).to.equal('31173');
			expect(leetSpeakEncode('leet')).to.equal('1337');
			expect(leetSpeakEncode('Hello World')).to.equal('H3110 W0r1d');
		});

		it('should handle empty strings', () => {
			expect(leetSpeakEncode('')).to.equal('');
		});

		it('should handle null and undefined', () => {
			expect(leetSpeakEncode(null)).to.equal(null);
			expect(leetSpeakEncode(undefined)).to.equal(undefined);
		});

		it('should preserve case and non-mapped characters', () => {
			expect(leetSpeakEncode('TESTING 123!')).to.equal('73571N6 123!');
		});
	});

	describe('leetSpeakDecode', () => {
		it('should convert leet speak back to normal text', () => {
			expect(leetSpeakDecode('31173')).to.equal('elite');
			expect(leetSpeakDecode('1337')).to.equal('leet');
			expect(leetSpeakDecode('H3110 W0r1d')).to.equal('Hello World');
		});

		it('should handle empty strings', () => {
			expect(leetSpeakDecode('')).to.equal('');
		});

		it('should handle null and undefined', () => {
			expect(leetSpeakDecode(null)).to.equal(null);
			expect(leetSpeakDecode(undefined)).to.equal(undefined);
		});

		it('should preserve non-mapped characters', () => {
			expect(leetSpeakDecode('73571N6 123!')).to.equal('testing 123!');
		});
	});

	describe('bidirectional conversion', () => {
		it('should correctly convert back and forth', () => {
			const original = 'The quick brown fox jumps over the lazy dog';
			const encoded = leetSpeakEncode(original);
			const decoded = leetSpeakDecode(encoded);
			
			// The lowercase version should match since case might be lost in conversion
			expect(decoded.toLowerCase()).to.equal(original.toLowerCase());
		});
	});
});
