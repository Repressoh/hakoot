import type { ElementContent, Nodes, Root } from "hast";
import { toHtml } from "hast-util-to-html";
import { h, s } from "hastscript";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

/** Whether the tree has raw HTML from the markdown source. */
function hasRaw(node: Nodes): boolean {
  if (node.type === "raw") {
    return true;
  }
  return "children" in node && node.children.some(hasRaw);
}

/** Convert parsed DOM nodes back to hast (as hast-util-from-dom does). */
function fromDom(nodes: NodeListOf<ChildNode>): ElementContent[] {
  const result: ElementContent[] = [];
  for (const node of nodes) {
    if (node instanceof Text) {
      result.push({ type: "text", value: node.data });
    } else if (node instanceof Element) {
      const properties = Object.fromEntries(
        Array.from(node.attributes, (attribute) => [
          attribute.name,
          attribute.value,
        ])
      );
      const children = fromDom(
        node instanceof HTMLTemplateElement
          ? node.content.childNodes
          : node.childNodes
      );
      result.push(
        node.namespaceURI === SVG_NAMESPACE
          ? s(node.localName, properties, children)
          : h(node.localName, properties, children)
      );
    }
    // Comments are dropped; the sanitizer would remove them anyway.
  }
  return result;
}

/**
 * Lets raw HTML in markdown through, like rehype-raw, but parses it with the browser's own HTML
 * parser instead of bundling parse5 (about 60 KB of compressed JavaScript). The tree is
 * serialized and parsed in an inert <template>, the same fragment context rehype-raw uses, so
 * nothing in it runs or loads; rehype-sanitize must still run afterwards. Browser-only.
 */
export function rehypeRawDom() {
  return (tree: Root): Root => {
    if (!hasRaw(tree)) {
      return tree;
    }
    const template = document.createElement("template");
    template.innerHTML = toHtml(tree, { allowDangerousHtml: true });
    return { children: fromDom(template.content.childNodes), type: "root" };
  };
}
