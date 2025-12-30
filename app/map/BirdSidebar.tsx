"use client"

import React, { useEffect, useState } from "react"
import axios from "axios"
import { X, ExternalLink, Loader2 } from "lucide-react"

interface BirdSidebarProps {
  speciesName: string | null
  onClose: () => void
}

interface WikiData {
  title: string
  extract: string
  thumbnail?: {
    source: string
  }
  content_urls?: {
    desktop?: {
      page: string
    }
  }
}

const BirdSidebar: React.FC<BirdSidebarProps> = ({ speciesName, onClose }) => {
  const [data, setData] = useState<WikiData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!speciesName) return

    const fetchWikiData = async () => {
      setLoading(true)
      setError(false)
      setData(null)

      try {
        // Wikipedia API için "Unknown" kontrolü
        if (speciesName.toLowerCase() === "unknown") {
          throw new Error("Unknown species")
        }

        const endpoint = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
            speciesName
        )}`
        
        const response = await axios.get(endpoint)
        setData(response.data)
      } catch (err) {
        console.error("Wikipedia fetch error:", err)
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    fetchWikiData()
  }, [speciesName])

  // Eğer seçim yoksa render etme
  if (!speciesName) return null

  return (
    <div className="fixed right-0 top-0 z-[2000] h-full w-full max-w-sm overflow-y-auto bg-black/80 p-6 text-white shadow-2xl backdrop-blur-xl transition-transform duration-300 sm:border-l sm:border-white/10">
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
      >
        <X size={24} />
      </button>

      <h2 className="mb-6 mt-8 text-3xl font-bold bg-gradient-to-r from-teal-400 to-indigo-400 bg-clip-text text-transparent">
        {speciesName}
      </h2>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 size={40} className="animate-spin text-teal-500" />
        </div>
      ) : error ? (
        <div className="rounded-xl bg-red-500/10 p-4 text-red-200 border border-red-500/20">
          <p>Could not load information for this bird.</p>
        </div>
      ) : data ? (
        <div className="flex flex-col gap-6">
          {data.thumbnail && (
            <div className="relative overflow-hidden rounded-2xl border-2 border-white/10 shadow-lg group">
              <img
                src={data.thumbnail.source}
                alt={data.title}
                className="w-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}

          <div className="prose prose-invert prose-sm">
            <p className="leading-relaxed text-gray-300 text-base">
              {data.extract}
            </p>
          </div>

          {data.content_urls?.desktop?.page && (
            <a
              href={data.content_urls.desktop.page}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-blue-600 py-3 font-semibold text-white transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-teal-500/20"
            >
              <span>Read on Wikipedia</span>
              <ExternalLink size={18} />
            </a>
          )}
        </div>
      ) : null}
    </div>
  )
}

export default BirdSidebar
