#!/usr/bin/env node
/**
 * Download unique Unsplash photos and convert to local AVIF subcategory cards.
 * Usage: node scripts/fetch-subcategory-images.mjs
 */
import { spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '../public/images/subcategories')
const TMP_DIR = '/tmp/kk-subcat-dl'
const WIDTH = 640
const HEIGHT = 800

function fileSlug(key) {
  return key.replace(/\//g, '-')
}

function unsplashUrl(photoId) {
  return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=${WIDTH}&h=${HEIGHT}&q=85`
}

async function exists(p) {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let err = ''
    child.stderr.on('data', (d) => { err += d.toString() })
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} exited ${code}: ${err.slice(-500)}`))
    })
  })
}

async function download(url, dest) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'KeshillaKosImageFetcher/1.0' },
    redirect: 'follow',
  })
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} for ${url}`)
  await pipeline(res.body, createWriteStream(dest))
  const { size } = await (await import('node:fs/promises')).stat(dest)
  if (size < 1000) throw new Error(`Download too small (${size}B) for ${url}`)
}

async function toAvif(jpgPath, avifPath) {
  await run('ffmpeg', [
    '-y', '-i', jpgPath,
    '-vf', `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT}`,
    '-frames:v', '1',
    '-c:v', 'libaom-av1',
    '-crf', '32',
    '-cpu-used', '6',
    '-still-picture', '1',
    avifPath,
  ])
}

async function main() {
  const map = JSON.parse(await readFile(path.join(__dirname, 'subcategory-unsplash-map.json'), 'utf8'))
  const ids = Object.values(map)
  if (new Set(ids).size !== ids.length) {
    throw new Error('Duplicate Unsplash IDs in map')
  }

  await mkdir(OUT_DIR, { recursive: true })
  await mkdir(TMP_DIR, { recursive: true })

  const entries = Object.entries(map)
  console.log(`Processing ${entries.length} subcategory images…`)

  const failures = []
  const concurrency = 3
  let i = 0

  async function worker() {
    while (i < entries.length) {
      const index = i++
      const [key, photoId] = entries[index]
      const slug = fileSlug(key)
      const avifPath = path.join(OUT_DIR, `${slug}.avif`)
      if (await exists(avifPath)) {
        console.log(`[${index + 1}/${entries.length}] skip ${slug}`)
        continue
      }
      const jpgPath = path.join(TMP_DIR, `${slug}.jpg`)
      console.log(`[${index + 1}/${entries.length}] ${slug} ← ${photoId}`)
      try {
        await download(unsplashUrl(photoId), jpgPath)
        await toAvif(jpgPath, avifPath)
      } catch (err) {
        console.error(`FAILED ${slug}:`, err.message)
        failures.push({ slug, photoId, error: err.message })
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  const paths = Object.fromEntries(
    Object.keys(map).map((key) => [key, `/images/subcategories/${fileSlug(key)}.avif`]),
  )
  await writeFile(path.join(TMP_DIR, 'local-paths.json'), JSON.stringify(paths, null, 2))

  if (failures.length) {
    console.error(`\n${failures.length} failures:`)
    for (const f of failures) console.error(` - ${f.slug}: ${f.error}`)
    process.exit(1)
  }
  console.log('All images downloaded and converted.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
