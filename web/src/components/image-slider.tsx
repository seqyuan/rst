'use client'

import { useState } from 'react'

export function ImageSlider({ images }: { images: string[] }) {
  const [idx, setIdx] = useState(0)
  const prev = () => setIdx((idx - 1 + images.length) % images.length)
  const next = () => setIdx((idx + 1) % images.length)

  return (
    <div className="border rounded-xl overflow-hidden my-4 bg-fd-card">
      <div className="relative bg-fd-muted/50 flex items-center justify-center p-4 min-h-[300px]">
        <button
          onClick={prev}
          className="absolute left-2 z-10 w-10 h-10 rounded-full bg-fd-background/80 border shadow flex items-center justify-center hover:bg-fd-background text-xl"
          aria-label="Previous"
        >
          ‹
        </button>
        <div className="text-center">
          <div className="w-48 h-48 mx-auto rounded-lg bg-fd-muted flex items-center justify-center text-4xl">
            🖼️
          </div>
          <p className="mt-3 text-sm font-medium">{images[idx]}</p>
        </div>
        <button
          onClick={next}
          className="absolute right-2 z-10 w-10 h-10 rounded-full bg-fd-background/80 border shadow flex items-center justify-center hover:bg-fd-background text-xl"
          aria-label="Next"
        >
          ›
        </button>
      </div>
      <div className="flex items-center justify-center gap-1.5 p-3 border-t bg-fd-muted/30">
        {images.map((img, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              i === idx ? 'bg-fd-primary' : 'bg-fd-muted-foreground/30 hover:bg-fd-muted-foreground/50'
            }`}
            aria-label={`Go to image ${i + 1}`}
          />
        ))}
        <span className="text-xs text-fd-muted-foreground ml-2">
          {idx + 1} / {images.length}
        </span>
      </div>
    </div>
  )
}
