"use client";

import { useMutation } from "convex/react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useEffect, useReducer } from "react";
import { toast } from "sonner";
import { preloadHighlighter } from "@/components/game/highlight-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAutosave } from "@/lib/use-autosave";
import { formatLineNumbers, parseLineRange } from "@/lib/utils";
import { SaveStatus } from "./save-status";

const ClientCodeBlock = dynamic(
  () =>
    import("@/components/game/client-code-block").then(
      (mod) => mod.ClientCodeBlock
    ),
  {
    loading: () => (
      <div className="animate-pulse rounded-lg border border-border bg-[#0d1117] p-4">
        <Skeleton className="h-4 w-3/4 rounded bg-muted/20" />
        <Skeleton className="mt-2 h-4 w-1/2 rounded bg-muted/20" />
      </div>
    ),
    ssr: false,
  }
);

const MarkdownViewer = dynamic(
  () =>
    import("@/components/game/markdown-viewer").then(
      (mod) => mod.MarkdownViewer
    ),
  {
    loading: () => (
      <div className="animate-pulse space-y-2">
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-4 w-5/6 rounded" />
        <Skeleton className="h-4 w-3/4 rounded" />
      </div>
    ),
    ssr: false,
  }
);

interface CodeAnnotation {
  explanation: string;
  label: string;
  lines: number[];
}

interface CodeBlock {
  annotations: CodeAnnotation[];
  code: string;
  language: string;
}

interface Step {
  _id: Id<"gameSteps">;
  codeBlock?: CodeBlock;
  markdownContent?: string;
  type: "theory" | "quiz";
}

interface Props {
  step: Step;
}

interface AnnotationForm {
  explanation: string;
  id: string;
  label: string;
  linesInput: string;
}

const LANGUAGES = [
  "typescript",
  "javascript",
  "python",
  "java",
  "rust",
  "go",
  "bash",
  "shell",
  "json",
  "html",
  "css",
  "sql",
  "markdown",
  "plaintext",
];

interface TheoryFormState {
  annotations: AnnotationForm[];
  code: string;
  hasCodeBlock: boolean;
  language: string;
  markdown: string;
}

type TheoryFormAction =
  | { type: "SET_MARKDOWN"; value: string }
  | { type: "SET_HAS_CODE_BLOCK"; value: boolean }
  | { type: "SET_CODE"; value: string }
  | { type: "SET_LANGUAGE"; value: string }
  | { type: "ADD_ANNOTATION" }
  | { type: "REMOVE_ANNOTATION"; index: number }
  | {
      type: "UPDATE_ANNOTATION";
      index: number;
      field: keyof AnnotationForm;
      value: string;
    };

/**
 * State transitions for the theory step form: markdown, the optional code block and its
 * annotations.
 */
function theoryFormReducer(
  state: TheoryFormState,
  action: TheoryFormAction
): TheoryFormState {
  switch (action.type) {
    case "SET_MARKDOWN":
      return { ...state, markdown: action.value };
    case "SET_HAS_CODE_BLOCK":
      return { ...state, hasCodeBlock: action.value };
    case "SET_CODE":
      return { ...state, code: action.value };
    case "SET_LANGUAGE":
      return { ...state, language: action.value };
    case "ADD_ANNOTATION":
      return {
        ...state,
        annotations: [
          ...state.annotations,
          {
            explanation: "",
            id: crypto.randomUUID(),
            label: "",
            linesInput: "",
          },
        ],
      };
    case "REMOVE_ANNOTATION":
      return {
        ...state,
        annotations: state.annotations.filter((_, idx) => idx !== action.index),
      };
    case "UPDATE_ANNOTATION":
      return {
        ...state,
        annotations: state.annotations.map((a, idx) =>
          idx === action.index ? { ...a, [action.field]: action.value } : a
        ),
      };
    default:
      return state;
  }
}

/**
 * The code block to store for the form, or null for none. Annotations are kept
 * while partly filled in, so that a draft survives leaving the page.
 */
function toCodeBlock({
  annotations,
  code,
  hasCodeBlock,
  language,
}: TheoryFormState): CodeBlock | null {
  if (!(hasCodeBlock && code.trim())) {
    return null;
  }
  return {
    annotations: annotations
      .filter((a) => a.linesInput.trim() || a.label || a.explanation)
      .map((a) => ({
        explanation: a.explanation,
        label: a.label,
        lines: parseLineRange(a.linesInput),
      })),
    code,
    language,
  };
}

/**
 * Editor for a theory step's markdown content and optional annotated code block; changes save
 * automatically.
 */
export function TheoryStepEditor({ step }: Props) {
  const t = useTranslations("stepEditor");
  const updateTheory = useMutation(api.steps.updateTheory);

  const [form, dispatch] = useReducer(theoryFormReducer, {
    annotations:
      step.codeBlock?.annotations.map((a) => ({
        explanation: a.explanation,
        id: crypto.randomUUID(),
        label: a.label,
        linesInput: formatLineNumbers(a.lines),
      })) ?? [],
    code: step.codeBlock?.code ?? "",
    hasCodeBlock: !!step.codeBlock,
    language: step.codeBlock?.language ?? "typescript",
    markdown: step.markdownContent ?? "",
  });

  const { markdown, hasCodeBlock, code, language, annotations } = form;

  const saveStatus = useAutosave(
    { codeBlock: toCodeBlock(form), markdownContent: markdown },
    (theory) => updateTheory({ ...theory, stepId: step._id }),
    () => toast.error(t("saveFailed"), { id: "step-autosave" })
  );

  // Start loading the highlighter when the editor opens rather than when the
  // code preview first renders.
  useEffect(() => {
    if (hasCodeBlock) {
      preloadHighlighter(language);
    }
  }, [hasCodeBlock, language]);

  function addAnnotation() {
    dispatch({ type: "ADD_ANNOTATION" });
  }

  function removeAnnotation(i: number) {
    dispatch({ index: i, type: "REMOVE_ANNOTATION" });
  }

  function updateAnnotation(
    i: number,
    field: keyof AnnotationForm,
    value: string
  ) {
    dispatch({ field, index: i, type: "UPDATE_ANNOTATION", value });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-semibold text-xl">{t("theoryTitle")}</h1>
        <SaveStatus status={saveStatus} />
      </div>

      {/* Markdown editor */}
      <div className="space-y-2">
        <Label>{t("markdownLabel")}</Label>
        <Tabs defaultValue="edit">
          <TabsList>
            <TabsTrigger value="edit">{t("editTab")}</TabsTrigger>
            <TabsTrigger value="preview">{t("previewTab")}</TabsTrigger>
          </TabsList>
          <TabsContent value="edit">
            <Textarea
              className="min-h-[200px] font-mono text-sm"
              onChange={(e) =>
                dispatch({ type: "SET_MARKDOWN", value: e.target.value })
              }
              placeholder={t("markdownPlaceholder")}
              value={markdown}
            />
          </TabsContent>
          <TabsContent className="min-h-[200px]" value="preview">
            {markdown ? (
              <MarkdownViewer content={markdown} />
            ) : (
              <p className="text-muted-foreground text-sm italic">
                Nothing to preview yet.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Separator />

      {/* Code block toggle */}
      <div className="flex items-center gap-3">
        <Switch
          aria-label={t("codeBlockToggle")}
          checked={hasCodeBlock}
          id="has-code"
          onCheckedChange={(v) =>
            dispatch({ type: "SET_HAS_CODE_BLOCK", value: v })
          }
        />
        <Label htmlFor="has-code">{t("codeBlockToggle")}</Label>
      </div>

      {hasCodeBlock ? (
        <div className="space-y-4 border-border border-l-2 pl-4">
          {/* Language */}
          <div className="space-y-1.5">
            <Label htmlFor="language">{t("languageLabel")}</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              id="language"
              onChange={(e) =>
                dispatch({ type: "SET_LANGUAGE", value: e.target.value })
              }
              value={language}
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          {/* Code textarea */}
          <div className="space-y-1.5">
            <Label htmlFor="code">{t("codeLabel")}</Label>
            <Textarea
              className="min-h-[200px] font-mono text-sm"
              id="code"
              onChange={(e) =>
                dispatch({ type: "SET_CODE", value: e.target.value })
              }
              placeholder={t("codePlaceholder")}
              spellCheck={false}
              value={code}
            />
          </div>

          {/* Annotations */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t("annotationsLabel")}</Label>
              <Button
                onClick={addAnnotation}
                size="sm"
                type="button"
                variant="outline"
              >
                + {t("addAnnotation")}
              </Button>
            </div>

            {annotations.map((ann, i) => (
              <div
                className="space-y-2 rounded-lg border border-border bg-muted/20 p-3"
                key={ann.id}
              >
                <div className="flex items-center justify-between">
                  <Badge className="text-xs" variant="secondary">
                    Annotation {i + 1}
                  </Badge>
                  <Button
                    className="h-6 text-muted-foreground hover:text-destructive"
                    onClick={() => removeAnnotation(i)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    {t("removeAnnotation")}
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">
                      {t("annotationLinesLabel")}
                    </Label>
                    <Input
                      className="h-8 text-sm"
                      onChange={(e) =>
                        updateAnnotation(i, "linesInput", e.target.value)
                      }
                      placeholder={t("annotationLinesPlaceholder")}
                      value={ann.linesInput}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">
                      {t("annotationLabelLabel")}
                    </Label>
                    <Input
                      className="h-8 text-sm"
                      onChange={(e) =>
                        updateAnnotation(i, "label", e.target.value)
                      }
                      placeholder={t("annotationLabelPlaceholder")}
                      value={ann.label}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">
                    {t("annotationExplanationLabel")}
                  </Label>
                  <Textarea
                    className="text-sm"
                    onChange={(e) =>
                      updateAnnotation(i, "explanation", e.target.value)
                    }
                    placeholder={t("annotationExplanationPlaceholder")}
                    rows={2}
                    value={ann.explanation}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Preview */}
          {code ? (
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">
                {t("previewTab")}
              </Label>
              <ClientCodeBlock code={code} language={language} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
