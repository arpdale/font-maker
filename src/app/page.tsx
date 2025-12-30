import Link from 'next/link';
import { Pencil, Upload, Type, FileText, Download } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-neutral-900 mb-4">
            Handwriting Font Generator
          </h1>
          <p className="text-xl text-neutral-600 max-w-2xl mx-auto">
            Transform your handwriting into a custom font. Draw characters or
            upload a sample, and download your personalized OTF/TTF font file.
          </p>
        </div>

        {/* Method Selection */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold text-neutral-800 text-center mb-8">
            Choose your method
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Draw Option */}
            <Link
              href="/create/draw"
              className="group block p-8 bg-white rounded-2xl border-2 border-neutral-200 hover:border-neutral-900 transition-all hover:shadow-lg"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-neutral-900 transition-colors">
                  <Pencil className="w-8 h-8 text-neutral-600 group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-2">
                  Draw Characters
                </h3>
                <p className="text-neutral-600">
                  Draw each character directly in your browser using your mouse,
                  trackpad, or stylus. Best for precise control.
                </p>
              </div>
            </Link>

            {/* Upload Option */}
            <Link
              href="/template"
              className="group block p-8 bg-white rounded-2xl border-2 border-neutral-200 hover:border-neutral-900 transition-all hover:shadow-lg"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-neutral-900 transition-colors">
                  <FileText className="w-8 h-8 text-neutral-600 group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-2">
                  Print & Scan Template
                </h3>
                <p className="text-neutral-600">
                  Download a printable template, fill it with your handwriting,
                  then scan or photograph it. Most natural results.
                </p>
              </div>
            </Link>
          </div>
        </div>

        {/* Features Section */}
        <div className="max-w-4xl mx-auto mt-20">
          <h2 className="text-2xl font-semibold text-neutral-800 text-center mb-8">
            Features
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 bg-white rounded-xl border border-neutral-200">
              <Type className="w-8 h-8 text-neutral-700 mb-3" />
              <h3 className="font-semibold text-neutral-900 mb-2">
                Extended Latin
              </h3>
              <p className="text-sm text-neutral-600">
                200+ characters including accents, punctuation, and symbols for
                full language support.
              </p>
            </div>

            <div className="p-6 bg-white rounded-xl border border-neutral-200">
              <svg
                className="w-8 h-8 text-neutral-700 mb-3"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
                <text
                  x="8"
                  y="15"
                  fontSize="8"
                  fontWeight="bold"
                  stroke="none"
                  fill="currentColor"
                >
                  fi
                </text>
              </svg>
              <h3 className="font-semibold text-neutral-900 mb-2">Ligatures</h3>
              <p className="text-sm text-neutral-600">
                Create beautiful ligatures like fi, fl, and custom combinations
                for professional typography.
              </p>
            </div>

            <div className="p-6 bg-white rounded-xl border border-neutral-200">
              <svg
                className="w-8 h-8 text-neutral-700 mb-3"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <h3 className="font-semibold text-neutral-900 mb-2">
                OTF & TTF Export
              </h3>
              <p className="text-sm text-neutral-600">
                Download your font in industry-standard formats compatible with
                all major operating systems.
              </p>
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className="max-w-4xl mx-auto mt-20">
          <h2 className="text-2xl font-semibold text-neutral-800 text-center mb-8">
            How it works
          </h2>

          <div className="flex flex-col md:flex-row gap-4 md:gap-8 items-center justify-center">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center text-sm font-bold">
                1
              </span>
              <span className="text-neutral-700">Draw or upload</span>
            </div>
            <div className="hidden md:block w-8 h-px bg-neutral-300" />
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center text-sm font-bold">
                2
              </span>
              <span className="text-neutral-700">Review & edit</span>
            </div>
            <div className="hidden md:block w-8 h-px bg-neutral-300" />
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center text-sm font-bold">
                3
              </span>
              <span className="text-neutral-700">Add ligatures</span>
            </div>
            <div className="hidden md:block w-8 h-px bg-neutral-300" />
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center text-sm font-bold">
                4
              </span>
              <span className="text-neutral-700">Download font</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-20 text-center text-sm text-neutral-500">
          <p>
            Built with Next.js and opentype.js. Your data stays in your browser.
          </p>
        </footer>
      </div>
    </div>
  );
}
