// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    return entry.isDirectory()
      ? sourceFiles(path)
      : /\.tsx?$/.test(path) && !path.includes(".test.")
        ? [path]
        : [];
  });
}
it("keeps route and component text and accessible labels in the shared catalog", () => {
  const failures: string[] = [];
  for (const file of [
    ...sourceFiles(resolve("src/app")),
    ...sourceFiles(resolve("src/components")),
  ]) {
    if (!file.endsWith(".tsx")) continue;
    const text = readFileSync(file, "utf8"),
      ast = ts.createSourceFile(
        file,
        text,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
    function report(node: ts.Node, value: string) {
      // Product brand marks, design-system version and a sample room code are
      // technical tokens. This exact list deliberately excludes English prose.
      if (
        !/[A-Za-z]/.test(value) ||
        ["TwoPlayer", "2P", "TP", "DS / 0.1", "ABCD 2345"].includes(
          value.trim(),
        )
      )
        return;
      failures.push(
        `${relative(process.cwd(), file)}:${ast.getLineAndCharacterOfPosition(node.getStart()).line + 1} ${value.trim()}`,
      );
    }
    function visit(node: ts.Node) {
      if (ts.isJsxText(node)) report(node, node.text);
      if (ts.isStringLiteral(node)) {
        function isRenderedValue(value: ts.Node): boolean {
          const parent = value.parent;
          if (ts.isJsxExpression(parent))
            return !ts.isJsxAttribute(parent.parent);
          if (ts.isParenthesizedExpression(parent))
            return isRenderedValue(parent);
          if (
            ts.isConditionalExpression(parent) &&
            (parent.whenTrue === value || parent.whenFalse === value)
          )
            return isRenderedValue(parent);
          if (
            ts.isBinaryExpression(parent) &&
            parent.right === value &&
            [
              ts.SyntaxKind.AmpersandAmpersandToken,
              ts.SyntaxKind.BarBarToken,
              ts.SyntaxKind.QuestionQuestionToken,
            ].includes(parent.operatorToken.kind)
          )
            return isRenderedValue(parent);
          return false;
        }
        if (isRenderedValue(node)) report(node, node.text);
      }
      if (
        ts.isJsxAttribute(node) &&
        [
          "aria-label",
          "aria-description",
          "title",
          "description",
          "placeholder",
          "alt",
        ].includes(node.name.getText()) &&
        node.initializer
      ) {
        function inspectLabel(value: ts.Node) {
          if (
            ts.isStringLiteral(value) ||
            ts.isNoSubstitutionTemplateLiteral(value)
          )
            report(value, value.text);
          else if (ts.isJsxExpression(value) && value.expression)
            inspectLabel(value.expression);
          else if (ts.isConditionalExpression(value)) {
            inspectLabel(value.whenTrue);
            inspectLabel(value.whenFalse);
          } else if (ts.isTemplateExpression(value)) {
            report(value.head, value.head.text);
            for (const span of value.templateSpans)
              report(span.literal, span.literal.text);
          }
        }
        inspectLabel(node.initializer);
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  expect(failures).toEqual([]);
});
it("keeps low-level game client errors semantic", () => {
  const failures: string[] = [];
  for (const file of sourceFiles(resolve("src/game/client"))) {
    const text = readFileSync(file, "utf8"),
      ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    function visit(node: ts.Node) {
      if (
        ts.isPropertyAssignment(node) &&
        ["label", "description", "message", "title"].includes(
          node.name.getText(),
        ) &&
        ts.isStringLiteral(node.initializer) &&
        /[A-Za-z]/.test(node.initializer.text)
      )
        failures.push(
          `${relative(process.cwd(), file)}: ${node.initializer.text}`,
        );
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "fillText" &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0]) &&
        /[A-Za-z]/.test(node.arguments[0].text)
      )
        failures.push(
          `${relative(process.cwd(), file)}: ${node.arguments[0].text}`,
        );
      if (ts.isNewExpression(node) && node.expression.getText() === "Error") {
        for (const argument of node.arguments ?? [])
          if (
            ts.isStringLiteral(argument) &&
            /[A-Za-z]\s+[A-Za-z]/.test(argument.text)
          )
            failures.push(`${relative(process.cwd(), file)}: ${argument.text}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  expect(failures).toEqual([]);
});
it("does not introduce inline English/Persian translation branches", () => {
  const failures = sourceFiles(resolve("src"))
    .filter((file) => !file.includes(`${resolve("src/i18n")}`))
    .filter((file) =>
      /locale\s*===?\s*["']fa["']\s*\?\s*["'`]/.test(
        readFileSync(file, "utf8"),
      ),
    )
    .map((file) => relative(process.cwd(), file));
  expect(failures).toEqual([]);
});
