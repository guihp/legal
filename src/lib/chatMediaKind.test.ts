import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertChatVideoAllowed,
  contentTypeForChatUpload,
  ensureMp4FileMeta,
  inferChatMediaKindFromFileMeta,
  isPassThroughChatMp4,
  isUnsupportedChatVideoFormat,
  needsChatVideoTranscode,
  CHAT_VIDEO_MAX_BYTES,
} from "./chatMediaKind.ts";

function fakeFile(name: string, type: string): File {
  return new File([new Uint8Array(8)], name, { type });
}

function largeFakeFile(name: string, type: string, size: number): File {
  const file = new File([new Uint8Array(8)], name, { type });
  Object.defineProperty(file, "size", { get: () => size });
  return file;
}

describe("chatMediaKind", () => {
  it("infere vídeo com MIME vazio e extensão .mp4", () => {
    assert.equal(inferChatMediaKindFromFileMeta(fakeFile("clip.mp4", "")), "video");
  });

  it("infere vídeo .mov mesmo com MIME vazio", () => {
    assert.equal(inferChatMediaKindFromFileMeta(fakeFile("clip.mov", "")), "video");
  });

  it("infere áudio m4a antes de tratar como vídeo", () => {
    assert.equal(inferChatMediaKindFromFileMeta(fakeFile("voice.m4a", "")), "audio");
  });

  it("isPassThroughChatMp4 rejeita MOV/WebM", () => {
    assert.equal(isPassThroughChatMp4(fakeFile("a.mov", "video/quicktime")), false);
    assert.equal(isPassThroughChatMp4(fakeFile("a.webm", "video/webm")), false);
    assert.equal(isPassThroughChatMp4(fakeFile("a.mp4", "video/mp4")), true);
    assert.equal(isPassThroughChatMp4(fakeFile("a.mp4", "")), true);
  });

  it("contentTypeForChatUpload preenche video/mp4 quando MIME vazio", () => {
    assert.equal(contentTypeForChatUpload(fakeFile("x.mp4", ""), "video"), "video/mp4");
  });

  it("needsChatVideoTranscode para MOV ou tamanho > 16MB", () => {
    assert.equal(
      needsChatVideoTranscode(fakeFile("a.mov", "video/quicktime"), CHAT_VIDEO_MAX_BYTES),
      true,
    );
    assert.equal(
      needsChatVideoTranscode(
        largeFakeFile("a.mp4", "video/mp4", CHAT_VIDEO_MAX_BYTES + 1),
        CHAT_VIDEO_MAX_BYTES,
      ),
      true,
    );
    assert.equal(
      needsChatVideoTranscode(fakeFile("a.mp4", "video/mp4"), CHAT_VIDEO_MAX_BYTES),
      false,
    );
  });

  it("assertChatVideoAllowed bloqueia MOV e arquivos grandes", () => {
    assert.throws(
      () => assertChatVideoAllowed(fakeFile("IMG_7860.mov", "video/quicktime")),
      /MOV\/WebM/,
    );
    assert.throws(
      () =>
        assertChatVideoAllowed(
          largeFakeFile("big.mp4", "video/mp4", CHAT_VIDEO_MAX_BYTES + 1),
        ),
      /limite é 16 MB/,
    );
    assert.doesNotThrow(() => assertChatVideoAllowed(fakeFile("ok.mp4", "video/mp4")));
  });

  it("isUnsupportedChatVideoFormat marca MOV", () => {
    assert.equal(isUnsupportedChatVideoFormat(fakeFile("a.mov", "video/quicktime")), true);
    assert.equal(isUnsupportedChatVideoFormat(fakeFile("a.mp4", "video/mp4")), false);
  });

  it("ensureMp4FileMeta normaliza nome e MIME", () => {
    const out = ensureMp4FileMeta(fakeFile("clip.mov", "video/quicktime"));
    assert.equal(out.type, "video/mp4");
    assert.match(out.name.toLowerCase(), /\.mp4$/);
  });
});
