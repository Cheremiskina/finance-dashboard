import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const outputDirectory = fileURLToPath(
  new URL('../public/', import.meta.url),
)

await mkdir(outputDirectory, {
  recursive: true,
})

const iconSvg = `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="512"
  height="512"
  viewBox="0 0 512 512"
>
  <defs>
    <linearGradient
      id="background"
      x1="72"
      y1="40"
      x2="440"
      y2="472"
      gradientUnits="userSpaceOnUse"
    >
      <stop stop-color="#6677FF"/>
      <stop offset="0.55" stop-color="#8464F4"/>
      <stop offset="1" stop-color="#4A55C7"/>
    </linearGradient>

    <linearGradient
      id="shine"
      x1="166"
      y1="138"
      x2="343"
      y2="388"
      gradientUnits="userSpaceOnUse"
    >
      <stop stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#E9E8FF"/>
    </linearGradient>
  </defs>

  <rect
    x="32"
    y="32"
    width="448"
    height="448"
    rx="118"
    fill="url(#background)"
  />

  <circle
    cx="390"
    cy="116"
    r="104"
    fill="#FFFFFF"
    fill-opacity="0.10"
  />

  <rect
    x="138"
    y="274"
    width="64"
    height="112"
    rx="25"
    fill="url(#shine)"
  />

  <rect
    x="224"
    y="214"
    width="64"
    height="172"
    rx="25"
    fill="url(#shine)"
  />

  <rect
    x="310"
    y="146"
    width="64"
    height="240"
    rx="25"
    fill="url(#shine)"
  />

  <path
    d="M139 184C179 161 210 171 241 148C271 126 304 107 369 106"
    fill="none"
    stroke="#FFFFFF"
    stroke-width="22"
    stroke-linecap="round"
  />
</svg>
`

async function createIcon(filename, size) {
  const outputPath = path.join(outputDirectory, filename)

  await sharp(Buffer.from(iconSvg))
    .resize(size, size)
    .png()
    .toFile(outputPath)
}

await Promise.all([
  createIcon('apple-touch-icon.png', 180),
  createIcon('pwa-192x192.png', 192),
  createIcon('pwa-512x512.png', 512),
  createIcon('favicon-32x32.png', 32),
])

console.log('Иконки приложения созданы в папке public.')