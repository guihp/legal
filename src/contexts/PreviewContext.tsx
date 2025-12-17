import React, { createContext, useContext, useState } from 'react';

interface PreviewContextType {
  previewName: string;
  setPreviewName: (name: string) => void;
  previewSubtitle: string;
  setPreviewSubtitle: (subtitle: string) => void;
  previewNameFont: string;
  setPreviewNameFont: (font: string) => void;
  previewNameSize: number;
  setPreviewNameSize: (size: number) => void;
  previewNameColor: string;
  setPreviewNameColor: (color: string) => void;
  previewNameBold: boolean;
  setPreviewNameBold: (bold: boolean) => void;
  previewSubtitleFont: string;
  setPreviewSubtitleFont: (font: string) => void;
  previewSubtitleSize: number;
  setPreviewSubtitleSize: (size: number) => void;
  previewSubtitleColor: string;
  setPreviewSubtitleColor: (color: string) => void;
  previewSubtitleBold: boolean;
  setPreviewSubtitleBold: (bold: boolean) => void;
  previewLogoSize: number;
  setPreviewLogoSize: (size: number) => void;
  isPreviewMode: boolean;
  setIsPreviewMode: (mode: boolean) => void;
}

const PreviewContext = createContext<PreviewContextType | undefined>(undefined);

export function usePreview() {
  const context = useContext(PreviewContext);
  if (context === undefined) {
    throw new Error('usePreview deve ser usado dentro de PreviewProvider');
  }
  return context;
}

interface PreviewProviderProps {
  children: React.ReactNode;
}

export function PreviewProvider({ children }: PreviewProviderProps) {
  const [previewName, setPreviewName] = useState('');
  const [previewSubtitle, setPreviewSubtitle] = useState('');
  const [previewNameFont, setPreviewNameFont] = useState('Inter');
  const [previewNameSize, setPreviewNameSize] = useState(20);
  const [previewNameColor, setPreviewNameColor] = useState('#FFFFFF');
  const [previewNameBold, setPreviewNameBold] = useState(false);
  const [previewSubtitleFont, setPreviewSubtitleFont] = useState('Inter');
  const [previewSubtitleSize, setPreviewSubtitleSize] = useState(12);
  const [previewSubtitleColor, setPreviewSubtitleColor] = useState('#9CA3AF');
  const [previewSubtitleBold, setPreviewSubtitleBold] = useState(false);
  const [previewLogoSize, setPreviewLogoSize] = useState(40);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const value: PreviewContextType = {
    previewName,
    setPreviewName,
    previewSubtitle,
    setPreviewSubtitle,
    previewNameFont,
    setPreviewNameFont,
    previewNameSize,
    setPreviewNameSize,
    previewNameColor,
    setPreviewNameColor,
    previewNameBold,
    setPreviewNameBold,
    previewSubtitleFont,
    setPreviewSubtitleFont,
    previewSubtitleSize,
    setPreviewSubtitleSize,
    previewSubtitleColor,
    setPreviewSubtitleColor,
    previewSubtitleBold,
    setPreviewSubtitleBold,
    previewLogoSize,
    setPreviewLogoSize,
    isPreviewMode,
    setIsPreviewMode,
  };

  return (
    <PreviewContext.Provider value={value}>
      {children}
    </PreviewContext.Provider>
  );
}