"use client"

import React, { useRef, useState, useCallback, useEffect } from "react"
import Webcam from "react-webcam"
import axios from "axios"
import { Camera, RefreshCw, Send, MapPin, AlertCircle } from "lucide-react"
import { createClient } from "@supabase/supabase-js"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useGlobalContext } from "../context/GlobalContext"

// ---------- Supabase Client ----------
const supabaseUrl = "https://zngkvqvsilewdlfuqmlj.supabase.co"
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuZ2t2cXZzaWxld2RsZnVxbWxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MDAzNDcsImV4cCI6MjA3NjA3NjM0N30.TOds7zC_wNwXKBGD6Ey_bz7FcvYgbQBDaQ6kAuijzwg"

const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Bucket adını kendine göre değiştir
const BUCKET_NAME = "bird-uploads"

type LocationType = { lat: number; lon: number }
type UploadResult = { publicUrl: string; path: string }

const CameraPage: React.FC = () => {
  const webcamRef = useRef<Webcam>(null)
  const router = useRouter()
  const { setLastBirdLocation } = useGlobalContext()

  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [location, setLocation] = useState<LocationType | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>("")

  // ---- Sayfa açılınca konum al ----
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          })
        },
        (err) => {
          console.error("Location Error:", err)
          setError("Konum alınamadı. Lütfen konum erişimine izin verin.")
        }
      )
    } else {
      setError("Bu tarayıcı konum özelliğini desteklemiyor.")
    }
  }, [])

  // ---- Fotoğraf çek ----
  const capture = useCallback(() => {
    const src = webcamRef.current?.getScreenshot()
    if (src) {
      setImageSrc(src)
      setStatus("")
      setError(null)
    }
  }, [])

  const retake = () => {
    setImageSrc(null)
    setStatus("")
    setError(null)
  }

  // ---- dataURL -> Blob ----
  const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
    const res = await fetch(dataUrl)
    return await res.blob()
  }

  // ---- Supabase upload + (publicUrl, path) döndür ----
  const uploadToSupabaseAndGetUrl = async (blob: Blob): Promise<UploadResult> => {
    const fileName = `bird-${Date.now()}.jpg`
    const filePath = `captures/${fileName}`

    const { data, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, blob, {
        contentType: "image/jpeg",
        upsert: false,
      })

    if (uploadError) {
      console.error("Supabase upload error:", uploadError)
      throw new Error(uploadError.message)
    }

    const { data: publicData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(data.path)

    if (!publicData?.publicUrl) {
      throw new Error("Supabase public URL alınamadı.")
    }

    return { publicUrl: publicData.publicUrl, path: data.path }
  }

  // ---- Ana akış: upload -> backend -> db insert ----
  const uploadImage = async () => {
    if (!imageSrc) {
      setError("Önce bir fotoğraf çekmelisin.")
      return
    }
    if (!location) {
      setError("Konum bilgisi alınamadı.")
      return
    }

    setLoading(true)
    setStatus("Görsel yükleniyor (Supabase)...")
    setError(null)

    try {
      // 1) dataURL -> Blob
      const blob = await dataUrlToBlob(imageSrc)

      // 2) Supabase Storage upload + public url
      const { publicUrl, path } = await uploadToSupabaseAndGetUrl(blob)
      console.log("Supabase public URL:", publicUrl)

      setStatus("Backend'e istek gönderiliyor...")

      // 3) Backend’e JSON gönder
      const payload = {
        image_url: publicUrl,
        location: { lat: location.lat, lon: location.lon },
      }

      const endpoint = "http://127.0.0.1:8000/api/v1/identify-url"
      const response = await axios.post(endpoint, payload, {
        headers: { "Content-Type": "application/json" },
      })

      const data = response.data
      console.log("Backend Response:", data)

      // 4) Backend yanıtından alanları yakala (fallback’li)
      const speciesName =
        data?.species_name ||
        data?.bird_name ||
        data?.bird ||
        data?.name ||
        "Unknown"

      const confidence =
        data?.confidence ??
        data?.score ??
        data?.probability ??
        (Array.isArray(data?.top_k) ? data?.top_k?.[0]?.confidence : null) ??
        null

      const speciesId =
        data?.species_id ??
        data?.class_id ??
        (Array.isArray(data?.top_k) ? data?.top_k?.[0]?.species_id : null) ??
        null

      setStatus("Sonuç kaydediliyor (DB)...")

      // 5) Supabase DB insert
      const { error: insertError } = await supabase.from("predictions").insert([
        {
          image_path: path, // text
          image_url: publicUrl, // text
          species_name: speciesName, // text
          species_id: speciesId, // int8 / int / text (kolon tipine göre)
          confidence: confidence, // float8
          geo: { lat: location.lat, lon: location.lon }, // jsonb
        },
      ])

      if (insertError) {
        console.error("DB insert error:", insertError)
        throw new Error(insertError.message)
      }

      setStatus(`Success! Bird: ${speciesName}`)
      
      // ---- Update Context & Redirect ----
      setLastBirdLocation({ lat: location.lat, lon: location.lon })
      
      // Short delay to show success message
      setTimeout(() => {
        router.push("/map")
      }, 1500)

    } catch (err: any) {
      console.error("Upload / Identify / Insert Error:", err)

      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "Bilinmeyen hata"

      if (err?.response?.status === 404) {
        setError("Endpoint /api/v1/identify-url bulunamadı. Backend'i kontrol et.")
      } else if (err?.response?.status === 422) {
        setError("Backend'den 422 (validation) hatası geldi. JSON şemasını kontrol et.")
      } else {
        setError(`İstek başarısız oldu: ${msg}`)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen w-full flex-col bg-gradient-to-b from-teal-950 via-slate-900 to-black text-white relative overflow-hidden">
      
      {/* Decorative Background Elements */}
      <div className="absolute top-[-20%] left-[-20%] h-[50vh] w-[50vh] rounded-full bg-teal-500/10 blur-[100px]" />
      <div className="absolute bottom-[-20%] right-[-20%] h-[50vh] w-[50vh] rounded-full bg-orange-500/10 blur-[100px]" />

      {/* Back to Map Button */}
      <Link href="/map" className="absolute top-6 left-6 z-50 flex items-center justify-center gap-2 rounded-full bg-black/40 px-5 py-2.5 text-white backdrop-blur-md transition-all hover:scale-105 active:scale-95 hover:bg-black/60 border border-white/10 shadow-lg group">
        <MapPin size={20} className="text-teal-400 group-hover:text-teal-300" />
        <span className="font-semibold tracking-wide">Map</span>
      </Link>
      
      {/* Camera View Area */}
      <div className="relative flex-1 w-full flex items-center justify-center p-6">
        <div className="relative w-full h-full max-w-lg max-h-[80vh] overflow-hidden rounded-[3rem] border-4 border-white/10 shadow-[0_0_40px_rgba(45,212,191,0.15)] ring-1 ring-white/20">
          {!imageSrc ? (
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={{ facingMode: "environment" }}
              className="h-full w-full object-cover"
            />
          ) : (
            <img src={imageSrc!} alt="Captured" className="h-full w-full object-cover" />
          )}

          {/* Location Badge (Overlay) */}
          <div className="absolute top-6 right-6 rounded-full bg-black/40 px-4 py-1.5 text-sm backdrop-blur-md border border-white/10 shadow-lg">
            {location ? (
              <div className="flex items-center text-teal-300">
                <MapPin size={14} className="mr-2" />
                <span className="font-medium">
                  {location.lat.toFixed(4)}, {location.lon.toFixed(4)}
                </span>
              </div>
            ) : (
              <div className="flex items-center text-amber-400">
                <MapPin size={14} className="mr-2 animate-pulse" />
                <span className="font-medium">Locating...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Controls Section (Bottom) */}
      <div className="w-full bg-black/60 backdrop-blur-xl rounded-t-[2.5rem] -mt-8 z-10 relative border-t border-white/5 pb-8 pt-8 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        <h1 className="mb-6 text-center text-2xl font-bold bg-gradient-to-r from-teal-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent tracking-tight">Bird Identification</h1>
        
        <div className="flex flex-col gap-5 max-w-md mx-auto px-6">
          {error && (
            <div className="flex items-center rounded-2xl bg-red-500/10 p-4 text-red-200 border border-red-500/20">
              <AlertCircle size={20} className="mr-3 text-red-400" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {status && !error && (
            <div className="rounded-2xl bg-teal-500/10 p-4 text-center text-teal-200 border border-teal-500/20 font-medium">
              {status}
            </div>
          )}

          <div className="flex justify-center gap-6 mt-2 items-center">
            {!imageSrc ? (
              <button
                onClick={capture}
                className="group relative flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-all hover:scale-105 active:scale-95"
              >
                <div className="absolute inset-0 rounded-full border-4 border-teal-500/30 group-hover:border-teal-500/50 transition-colors" />
                <div className="h-16 w-16 rounded-full bg-gradient-to-tr from-teal-500 to-cyan-400 p-0.5">
                    <div className="h-full w-full rounded-full bg-white flex items-center justify-center">
                        <Camera size={32} className="text-teal-600" />
                    </div>
                </div>
              </button>
            ) : (
              <>
                <button
                  onClick={retake}
                  disabled={loading}
                  className="flex flex-1 items-center justify-center rounded-2xl bg-slate-800/80 py-4 font-semibold text-slate-200 transition-all hover:bg-slate-700 active:scale-95 disabled:opacity-50 ring-1 ring-white/5 hover:ring-white/10"
                >
                  <RefreshCw size={20} className="mr-2.5" />
                  Retake
                </button>

                <button
                  onClick={uploadImage}
                  disabled={loading || !location}
                  className="flex flex-1 items-center justify-center rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 py-4 font-bold text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-50 shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40"
                >
                  {loading ? (
                    <span className="flex items-center animate-pulse">
                      Sending...
                    </span>
                  ) : (
                    <>
                      <Send size={20} className="mr-2.5" />
                      Identify
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CameraPage
