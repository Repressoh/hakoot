"use client";

import { useAuthToken } from "@convex-dev/auth/react";
import { Image01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { StepImage, type StepImageView } from "@/components/game/step-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  prepareStepImage,
  STEP_IMAGE_TYPES,
  StepImageError,
  type StepImageErrorReason,
  uploadStepImage,
} from "@/lib/step-image";
import { getUnsavedDraft, useAutosave } from "@/lib/use-autosave";
import { cn } from "@/lib/utils";
import { SaveStatus } from "./save-status";

/** The `stepEditor` message for each reason an upload fails. */
const ERROR_MESSAGES = {
  rateLimited: "imageRateLimited",
  tooLarge: "imageTooLarge",
  unreadable: "imageUnreadable",
  unsupportedType: "imageUnsupportedType",
  uploadFailed: "imageUploadFailed",
} as const satisfies Record<StepImageErrorReason, string>;

/** Prepare and upload `file` as the step's image; returns why it failed, or null. */
async function tryUpload(
  stepId: Id<"gameSteps">,
  file: File,
  token: string
): Promise<StepImageErrorReason | null> {
  try {
    await uploadStepImage(stepId, await prepareStepImage(file), token);
    return null;
  } catch (error) {
    return error instanceof StepImageError ? error.reason : "uploadFailed";
  }
}

/** A step's image as the editor gets it: with the id of its file. */
export type EditorStepImage = StepImageView & { storageId: Id<"_storage"> };

interface AltInputProps {
  disabled: boolean;
  image: EditorStepImage;
  stepId: Id<"gameSteps">;
}

/**
 * The alt text of one image, saved as it is typed. Its saves name the image's file, so one made
 * for an image that has since been replaced (say, from another tab) doesn't describe the new one.
 * Keyed by that file, so a new image starts from its own, empty, description.
 */
function ImageAltInput({ disabled, image, stepId }: AltInputProps) {
  const t = useTranslations("stepEditor");
  const setImageAlt = useMutation(api.steps.setImageAlt);
  const draftKey = `${stepId}:image-alt:${image.storageId}`;
  const [alt, setAlt] = useState(
    () => getUnsavedDraft<string>(draftKey) ?? image.alt
  );
  const id = useId();

  const saveStatus = useAutosave<string>(
    draftKey,
    alt,
    (latest) =>
      setImageAlt({ alt: latest, stepId, storageId: image.storageId }),
    () => toast.error(t("saveFailed"), { id: "step-autosave" })
  );

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{t("imageAltLabel")}</Label>
        {/* The step's status above doesn't cover this field. */}
        {saveStatus === "saved" ? null : <SaveStatus status={saveStatus} />}
      </div>
      <Input
        disabled={disabled}
        id={id}
        maxLength={500}
        onChange={(event) => setAlt(event.target.value)}
        placeholder={t("imageAltPlaceholder")}
        value={alt}
      />
    </div>
  );
}

interface Props {
  image: EditorStepImage | null;
  stepId: Id<"gameSteps">;
}

/**
 * The optional image of a step: choose or drop a file to upload it right away, then describe it.
 * Unlike the step's text, the image isn't part of the step's autosaved form: the upload stores it.
 */
export function StepImageField({ image, stepId }: Props) {
  const t = useTranslations("stepEditor");
  const token = useAuthToken();
  const removeImage = useMutation(api.steps.removeImage);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<"remove" | "upload" | null>(null);
  const busy = pending !== null;
  const hintId = useId();

  async function upload(file: File) {
    if (!token) {
      toast.error(t("imageUploadFailed"), { id: "step-image" });
      return;
    }
    setPending("upload");
    const failure = await tryUpload(stepId, file, token);
    setPending(null);
    if (failure) {
      toast.error(t(ERROR_MESSAGES[failure]), { id: "step-image" });
    }
  }

  async function remove() {
    setPending("remove");
    const removed = await removeImage({ stepId }).then(
      () => true,
      () => false
    );
    setPending(null);
    if (!removed) {
      toast.error(t("imageRemoveFailed"), { id: "step-image" });
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label>{t("imageLabel")}</Label>
        {image ? (
          <div className="flex gap-2">
            <Button
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              size="sm"
              type="button"
              variant="outline"
            >
              {t("replaceImage")}
            </Button>
            <Button
              className="text-muted-foreground hover:text-destructive"
              disabled={busy}
              onClick={remove}
              size="sm"
              type="button"
              variant="ghost"
            >
              {t("removeImage")}
            </Button>
          </div>
        ) : null}
      </div>

      <div
        className={cn(
          "relative rounded-xl border-2 border-border border-dashed p-3 transition-colors",
          !image &&
            "hover:border-primary/60 hover:bg-primary/5 has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
          busy && "opacity-60"
        )}
      >
        {image ? (
          <StepImage image={image} />
        ) : (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <HugeiconsIcon
              aria-hidden="true"
              className="size-8 text-muted-foreground"
              icon={Image01Icon}
              strokeWidth={1.5}
            />
            <p className="font-medium text-sm">{t("addImage")}</p>
            <p className="text-muted-foreground text-xs">
              {t("imageDropHint")}
            </p>
          </div>
        )}
        {/* Without an image, the file input covers the box, so a file can be
            dropped on it as well as chosen. With one, the Replace button opens it. */}
        <input
          accept={STEP_IMAGE_TYPES.join(",")}
          aria-describedby={hintId}
          aria-label={image ? t("replaceImage") : t("addImage")}
          className={
            image
              ? "sr-only"
              : "absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-progress"
          }
          disabled={busy}
          onChange={(event) => {
            const [file] = event.target.files ?? [];
            // Cleared so choosing the same file again uploads it again.
            event.target.value = "";
            if (file) {
              upload(file);
            }
          }}
          ref={inputRef}
          tabIndex={image ? -1 : undefined}
          type="file"
        />
      </div>
      <p
        aria-live="polite"
        className="text-muted-foreground text-xs"
        id={hintId}
      >
        {pending === "upload" ? t("uploadingImage") : t("imageHint")}
      </p>

      {image ? (
        <ImageAltInput
          disabled={busy}
          image={image}
          key={image.storageId}
          stepId={stepId}
        />
      ) : null}
    </div>
  );
}
