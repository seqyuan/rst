import defaultMdxComponents from 'fumadocs-ui/mdx'
import type { MDXComponents } from 'mdx/types'
import { ImageSlider } from './image-slider'

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    ImageSlider,
    ...components,
  } satisfies MDXComponents
}

export const useMDXComponents = getMDXComponents

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>
}
