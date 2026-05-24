"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  MOCK_STAFF,
  Staff,
  getStaffRoleLabel,
  getStaffTimeoutSetting,
  getStoredStaffSession,
  hashStaffPin,
  saveStaffSession,
  setStaffTimeoutSetting,
} from "@/lib/waiter-session"

type LoginView = "select-profile" | "pin-input" | "qr-scanner"

export default function WaiterLoginPage() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [currentView, setCurrentView] = useState<LoginView>("select-profile")
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)
  const [pinInput, setPinInput] = useState("")
  const [pinError, setPinError] = useState(false)
  const [sessionTimeoutSetting, setSessionTimeoutSetting] = useState(() => getStaffTimeoutSetting())
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [isScanningSimulated, setIsScanningSimulated] = useState(false)
  const [hasCameraError, setHasCameraError] = useState(false)

  const triggerToast = useCallback((msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }, [])

  const handleLoginSuccess = useCallback(
    (staff: Staff) => {
      saveStaffSession(staff)
      triggerToast(`Bienvenido, ${staff.name}`)
      router.replace("/waiter/control")
    },
    [router, triggerToast]
  )

  const handlePinInput = useCallback(
    async (num: string, currentStaff: Staff) => {
      if (pinError) return

      const newPin = (pinInput + num).slice(0, 4)
      setPinInput(newPin)

      if (newPin.length === 4) {
        const hashed = await hashStaffPin(newPin)

        if (hashed === currentStaff.pin_hash) {
          handleLoginSuccess(currentStaff)
        } else {
          setPinError(true)
          triggerToast("PIN incorrecto")
          setTimeout(() => {
            setPinInput("")
            setPinError(false)
          }, 600)
        }
      }
    },
    [handleLoginSuccess, pinError, pinInput, triggerToast]
  )

  const handleBackspace = useCallback(() => {
    if (pinError) return
    setPinInput((prev) => prev.slice(0, -1))
  }, [pinError])

  const handleClear = useCallback(() => {
    if (pinError) return
    setPinInput("")
  }, [pinError])

  const updateTimeoutSetting = (val: number) => {
    setSessionTimeoutSetting(val)
    setStaffTimeoutSetting(val)
    triggerToast(`Limite de inactividad: ${val === 28800 ? "8 horas" : `${val} segundos`}`)
  }

  const triggerMockQrScan = (staff: Staff) => {
    setIsScanningSimulated(true)
    triggerToast(`Escaneando QR de ${staff.name}...`)

    setTimeout(() => {
      setIsScanningSimulated(false)
      handleLoginSuccess(staff)
    }, 1200)
  }

  useEffect(() => {
    if (getStoredStaffSession()) {
      router.replace("/waiter/control")
    }
  }, [router])

  useEffect(() => {
    if (currentView !== "pin-input" || !selectedStaff) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        handlePinInput(e.key, selectedStaff)
      } else if (e.key === "Backspace") {
        handleBackspace()
      } else if (e.key === "Escape") {
        setCurrentView("select-profile")
        setSelectedStaff(null)
        setPinInput("")
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [currentView, handleBackspace, handlePinInput, selectedStaff])

  useEffect(() => {
    if (currentView !== "qr-scanner") return

    let streamObj: MediaStream | null = null

    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: "environment" } })
        .then((stream) => {
          streamObj = stream
          if (videoRef.current) {
            videoRef.current.srcObject = stream
          }
          setHasCameraError(false)
        })
        .catch((err) => {
          console.warn("webcam access denied or failed:", err)
          setHasCameraError(true)
        })
    } else {
      setTimeout(() => setHasCameraError(true), 0)
    }

    return () => {
      streamObj?.getTracks().forEach((track) => track.stop())
    }
  }, [currentView])

  const getGreeting = () => {
    const hr = new Date().getHours()
    if (hr < 12) return "Buenos dias"
    if (hr < 19) return "Buenas tardes"
    return "Buenas noches"
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#FAF9F5] p-6 font-sans text-stone-900 selection:bg-orange-100 selection:text-orange-900">
      <div className="absolute top-0 left-1/4 -z-10 h-96 w-96 rounded-full bg-orange-100/40 blur-3xl" />
      <div
        className="absolute top-1/3 right-1/4 -z-10 h-[500px] w-[500px] rounded-full bg-orange-50/20 blur-3xl animate-pulse-glow"
        style={{ "--glow-color": "rgba(251, 146, 60, 0.08)" } as React.CSSProperties}
      />

      {toastMessage && (
        <div className="fixed right-6 bottom-6 z-50 flex animate-card-entrance items-center gap-3 rounded-2xl border border-stone-200/80 bg-white/95 px-5 py-4 shadow-2xl shadow-stone-900/10 backdrop-blur-xl">
          <div className="h-2 w-2 animate-ping rounded-full bg-orange-500" />
          <p className="text-sm font-semibold text-stone-800">{toastMessage}</p>
        </div>
      )}

      <div className="absolute top-6 right-6 z-20 flex items-center gap-2">
        <div className="relative group">
          <button className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-stone-200 bg-white/80 text-stone-600 shadow-sm backdrop-blur-md transition hover:border-stone-400 hover:bg-white">
            <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          <div className="absolute right-0 z-30 mt-2 hidden w-48 origin-top-right rounded-xl border border-stone-200 bg-white p-2 shadow-lg transition group-hover:block">
            <div className="mb-1 border-b border-stone-100 px-2 py-1 pb-1 text-[10px] font-bold tracking-wider text-stone-400 uppercase">
              Auto-cierre
            </div>
            <button onClick={() => updateTimeoutSetting(10)} className={`w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold hover:bg-stone-50 ${sessionTimeoutSetting === 10 ? "bg-orange-50 font-bold text-orange-600" : "text-stone-600"}`}>
              10 seg
            </button>
            <button onClick={() => updateTimeoutSetting(60)} className={`w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold hover:bg-stone-50 ${sessionTimeoutSetting === 60 ? "bg-orange-50 font-bold text-orange-600" : "text-stone-600"}`}>
              1 minuto
            </button>
            <button onClick={() => updateTimeoutSetting(300)} className={`w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold hover:bg-stone-50 ${sessionTimeoutSetting === 300 ? "bg-orange-50 font-bold text-orange-600" : "text-stone-600"}`}>
              5 minutos
            </button>
            <button onClick={() => updateTimeoutSetting(28800)} className={`w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold hover:bg-stone-50 ${sessionTimeoutSetting === 28800 ? "bg-orange-50 font-bold text-orange-600" : "text-stone-600"}`}>
              8 horas
            </button>
          </div>
        </div>
      </div>

      <div className="mb-10 max-w-md animate-card-entrance text-center">
        <Link href="/" className="mb-5 inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-stone-600 shadow-sm transition hover:border-stone-400">
          MESA
        </Link>
        <span className="rounded-full border border-orange-200/50 bg-orange-50 px-3 py-1 text-[10px] font-bold tracking-widest text-orange-600 uppercase">
          Portal meseros
        </span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-stone-900">{getGreeting()}</h1>
        <p className="mt-2 text-sm text-stone-500">Elige tu perfil e ingresa con PIN. Sin base de datos por ahora.</p>
      </div>

      {currentView === "select-profile" && (
        <div className="relative z-10 flex w-full max-w-2xl animate-card-entrance flex-col items-center rounded-[2.5rem] border border-stone-200/80 bg-white/70 p-8 shadow-2xl backdrop-blur-xl">
          <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-3">
            {MOCK_STAFF.map((staff) => {
              const initials = staff.name.substring(0, 2).toUpperCase()

              return (
                <button
                  key={staff.id}
                  onClick={() => {
                    setSelectedStaff(staff)
                    setPinInput("")
                    setCurrentView("pin-input")
                  }}
                  className="group flex cursor-pointer flex-col items-center justify-between rounded-2xl border border-stone-200/60 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-orange-300 hover:shadow-md"
                >
                  <div className={`flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr ${staff.avatar_color} text-xl font-bold text-white shadow-md shadow-stone-300/40 transition group-hover:scale-105`}>
                    {initials}
                  </div>
                  <div className="mt-4 text-center">
                    <h2 className="text-base leading-tight font-bold text-stone-900">{staff.name}</h2>
                    <span className="mt-2 inline-block rounded bg-stone-100 px-2 py-0.5 text-[10px] font-bold tracking-wider text-stone-500 uppercase">
                      {getStaffRoleLabel(staff.role)}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>

          <button
            onClick={() => setCurrentView("qr-scanner")}
            className="mt-6 rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-xs font-bold text-stone-600 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700"
          >
            Entrar con QR simulado
          </button>
        </div>
      )}

      {currentView === "pin-input" && selectedStaff && (
        <div className="relative z-10 flex w-full max-w-sm animate-card-entrance flex-col items-center rounded-[2.5rem] border border-stone-200/80 bg-white/70 p-8 shadow-2xl backdrop-blur-xl">
          <button
            onClick={() => {
              setCurrentView("select-profile")
              setSelectedStaff(null)
              setPinInput("")
            }}
            className="absolute top-6 left-6 cursor-pointer text-stone-400 transition hover:text-stone-700"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>

          <div className="mb-6 flex flex-col items-center text-center">
            <div className={`flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr ${selectedStaff.avatar_color} text-lg font-bold text-white shadow`}>
              {selectedStaff.name.substring(0, 2).toUpperCase()}
            </div>
            <h2 className="mt-2 text-base font-bold text-stone-900">{selectedStaff.name}</h2>
            <p className="mt-0.5 text-[11px] font-bold tracking-widest text-stone-400 uppercase">PIN de 4 digitos</p>
          </div>

          <div className={`mb-6 flex justify-center gap-4 py-4 ${pinError ? "animate-shake" : ""}`}>
            {[0, 1, 2, 3].map((idx) => {
              const filled = pinInput.length > idx

              return (
                <div
                  key={idx}
                  className={`h-4.5 w-4.5 rounded-full border-2 transition-all duration-150 ${
                    pinError
                      ? "border-red-500 bg-red-100 shadow-[0_0_10px_rgba(239,68,68,0.3)]"
                      : filled
                      ? "border-orange-500 bg-orange-500 shadow-[0_0_8px_#f97316]"
                      : "border-stone-300 bg-white"
                  }`}
                />
              )
            })}
          </div>

          <div className="grid w-full grid-cols-3 gap-3.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button key={num} onClick={() => handlePinInput(String(num), selectedStaff)} className="h-14 w-full cursor-pointer rounded-2xl border border-stone-200/60 bg-white text-lg font-bold text-stone-700 shadow-sm transition hover:bg-stone-50 active:scale-95">
                {num}
              </button>
            ))}
            <button onClick={handleClear} className="flex h-14 w-full cursor-pointer items-center justify-center rounded-2xl border border-stone-200/60 bg-stone-50 text-sm font-bold text-stone-500 shadow-sm transition hover:bg-stone-100 active:scale-95">
              C
            </button>
            <button onClick={() => handlePinInput("0", selectedStaff)} className="h-14 w-full cursor-pointer rounded-2xl border border-stone-200/60 bg-white text-lg font-bold text-stone-700 shadow-sm transition hover:bg-stone-50 active:scale-95">
              0
            </button>
            <button onClick={handleBackspace} className="flex h-14 w-full cursor-pointer items-center justify-center rounded-2xl border border-stone-200/60 bg-stone-50 text-base font-bold text-stone-500 shadow-sm transition hover:bg-stone-100 active:scale-95">
              Borrar
            </button>
          </div>
        </div>
      )}

      {currentView === "qr-scanner" && (
        <div className="relative z-10 flex w-full max-w-lg animate-card-entrance flex-col items-center rounded-[2.5rem] border border-stone-200/80 bg-white/70 p-8 shadow-2xl backdrop-blur-xl">
          <button
            onClick={() => setCurrentView("select-profile")}
            className="absolute top-6 left-6 cursor-pointer text-stone-400 transition hover:text-stone-700"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>

          <h2 className="text-base font-bold text-stone-900">QR de staff</h2>
          <p className="mt-1 text-center text-xs text-stone-500">Camara real cuando este disponible, acceso simulado para desarrollo.</p>

          <div className="mt-5 h-48 w-full overflow-hidden rounded-2xl border border-stone-200 bg-stone-950">
            {hasCameraError ? (
              <div className="flex h-full items-center justify-center px-6 text-center text-xs font-semibold text-stone-300">
                Camara no disponible en este entorno.
              </div>
            ) : (
              <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
            )}
          </div>

          <div className="mt-5 grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
            {MOCK_STAFF.map((staff) => (
              <button
                key={staff.id}
                onClick={() => triggerMockQrScan(staff)}
                disabled={isScanningSimulated}
                className="rounded-2xl border border-stone-200 bg-white px-3 py-3 text-xs font-bold text-stone-700 transition hover:border-orange-300 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isScanningSimulated ? "Escaneando..." : staff.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="z-10 mt-12 w-full max-w-sm animate-card-entrance overflow-hidden rounded-2xl border border-stone-200 bg-white/70 shadow-sm backdrop-blur-md">
        <details className="group">
          <summary className="flex cursor-pointer select-none items-center justify-between px-4 py-3 text-xs font-bold text-stone-500 hover:bg-stone-50">
            <span>Credenciales de desarrollo</span>
            <svg className="h-4 w-4 text-stone-400 transition group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </summary>
          <div className="space-y-2 border-t border-stone-100 px-4 pt-3 pb-4 text-xs text-stone-600">
            <p>Usa estos PINs para iniciar sesion:</p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              {MOCK_STAFF.map((staff) => (
                <div key={staff.id} className="rounded-lg border border-stone-100 bg-stone-50/50 p-2">
                  <p className="font-bold text-stone-800">{staff.name}</p>
                  <p className="text-[9px] tracking-tighter text-stone-400 uppercase">{getStaffRoleLabel(staff.role)}</p>
                  <code className="mt-1 block rounded bg-orange-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-orange-600">
                    {staff.id === "1" ? "4821" : staff.id === "2" ? "1234" : "7788"}
                  </code>
                </div>
              ))}
            </div>
          </div>
        </details>
      </div>
    </main>
  )
}
