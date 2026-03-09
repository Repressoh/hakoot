"use client";

import { useMutation } from "convex/react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
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
import { formatLineNumbers, parseLineRange } from "@/lib/utils";

const ClientCodeBlock = dynamic(
  () =>
    import("@/components/game/client-code-block").then(
      (mod) => mod.ClientCodeBlock
    ),
  {
    ssr: false,
    loading: () => (
      <div className="animate-pulse rounded-lg border border-border bg-[#0d1117] p-4">
        <Skeleton className="h-4 w-3/4 rounded bg-muted/20" />
        <Skeleton className="mt-2 h-4 w-1/2 rounded bg-muted/20" />
      </div>
    ),
  }
);

const MarkdownViewer = dynamic(
  () =>
    import("@/components/game/markdown-viewer").then(
      (mod) => mod.MarkdownViewer
    ),
  {
    ssr: false,
    loading: () => (
      <div className="animate-pulse space-y-2">
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-4 w-5/6 rounded" />
        <Skeleton className="h-4 w-3/4 rounded" />
      </div>
    ),
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

export function TheoryStepEditor({ step }: Props) {
  const t = useTranslations("stepEditor");
  const updateTheory = useMutation(api.steps.updateTheory);
  const [saving, setSaving] = useState(false);

  const [markdown, setMarkdown] = useState(step.markdownContent ?? "");
  const [hasCodeBlock, setHasCodeBlock] = useState(!!step.codeBlock);
  const [code, setCode] = useState(step.codeBlock?.code ?? "");
  const [language, setLanguage] = useState(
    step.codeBlock?.language ?? "typescript"
  );
  const [annotations, setAnnotations] = useState<AnnotationForm[]>(
    step.codeBlock?.annotations.map((a) => ({
      id: crypto.randomUUID(),
      linesInput: formatLineNumbers(a.lines),
      label: a.label,
      explanation: a.explanation,
    })) ?? []
  );

  function addAnnotation() {
    setAnnotations((prev) => [
      ...prev,
      { id: crypto.randomUUID(), linesInput: "", label: "", explanation: "" },
    ]);
  }

  function removeAnnotation(i: number) {
    setAnnotations((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateAnnotation(
    i: number,
    field: keyof AnnotationForm,
    value: string
  ) {
    setAnnotations((prev) =>
      prev.map((a, idx) => (idx === i ? { ...a, [field]: value } : a))
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      let codeBlock: CodeBlock | undefined;
      if (hasCodeBlock && code.trim()) {
        const parsedAnnotations: CodeAnnotation[] = annotations
          .filter((a) => a.linesInput && a.label && a.explanation)
          .map((a) => ({
            lines: parseLineRange(a.linesInput),
            label: a.label,
            explanation: a.explanation,
          }));

        codeBlock = { code, language, annotations: parsedAnnotations };
      }

      await updateTheory({
        stepId: step._id,
        markdownContent: markdown,
        codeBlock,
      });
      toast.success("Saved!");
      setSaving(false);
    } catch {
      toast.error("Failed to save");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-bold text-xl">{t("theoryTitle")}</h1>
        <Button disabled={saving} onClick={handleSave}>
          {saving ? "Saving..." : t("saveStep")}
        </Button>
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
              onChange={(e) => setMarkdown(e.target.value)}
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
          onCheckedChange={setHasCodeBlock}
        />
        <Label htmlFor="has-code">{t("codeBlockToggle")}</Label>
      </div>

      {hasCodeBlock && (
        <div className="space-y-4 border-border border-l-2 pl-4">
          {/* Language */}
          <div className="space-y-1.5">
            <Label htmlFor="language">{t("languageLabel")}</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              id="language"
              onChange={(e) => setLanguage(e.target.value)}
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
              onChange={(e) => setCode(e.target.value)}
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
          {code && (
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">
                {t("previewTab")}
              </Label>
              <ClientCodeBlock code={code} language={language} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
