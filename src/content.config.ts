import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Each .md file in src/content/blog/ becomes a post. Frontmatter is type-checked below.
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    desc: z.string().optional(),
  }),
});

export const collections = { blog };
