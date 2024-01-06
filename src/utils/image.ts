import type { Sharp } from "sharp";
import sharp from "sharp";
import { escapeXml } from "./string.js";

/**
 * Gets an image of the provided text.
 * @param text The text
 * @param color The color name to use, for example: `red`, `white`
 * @param size The text size
 * @returns A Sharp instance containing the text in png format
 */
export async function textImage(text: string, color: string, size: number): Promise<Sharp> {
	// adding "Dg" forces the text image to be as tall as possible,
	const img = sharp({
		text: {
			text: `<span foreground="${color}">Dg ${escapeXml(text)} Dg</span>`,
			dpi: 72 * size,
			font: "Splatoon2",
			rgba: true,
		},
	});
	const metadata = await img.metadata();
	const width = Math.ceil((metadata.width ?? 15.5 * 2 * size) - 15.5 * 2 * size);

	const height = metadata.height ?? 0;
	// cuts off the "Dg" text while keeping the height
	return img.resize(width, height).png();
}
