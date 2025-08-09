import { describe, it, expect } from "bun:test";
import { GoogleDocConverter } from "../src/services/GoogleDocConverter.ts";

function normalize(text: string): string {
    return text
        .replace(/\r\n/g, "\n")
        .split("\n")
        .map((line) => line.replace(/\s+$/g, ""))
        .join("\n")
        .trim();
}

const files = await (async () => {
    const glob = new Bun.Glob("tests/fixtures/google-docs/*.json");
    const list: string[] = [];
    for await (const p of glob.scan(".")) list.push(p);
    return list;
})();

describe("GoogleDocConverter.convertToMarkdown", () => {
    for (const file of files) {
        const base = file.split("/").pop()!;
        const name = base.replace(/\.json$/, "");

        it(`converts ${name}.json to expected markdown`, async () => {
            const jsonText = await Bun.file(file).text();
            const doc = JSON.parse(jsonText);

            const expectedPath = `tests/fixtures/markdown/${name}.md`;
            const expected = await Bun.file(expectedPath).text();

            const actual = GoogleDocConverter.convertToMarkdown(doc);

            const normActual = normalize(actual);
            const normExpected = normalize(expected);

            if (normActual !== normExpected) {
                // Ensure output directory exists and write the actual output for inspection
                Bun.spawnSync({ cmd: ["bash", "-lc", "mkdir -p tests/output"] });
                await Bun.write(`tests/output/${name}.actual.md`, actual);
            }

            expect(normActual).toBe(normExpected);
        });
    }
});