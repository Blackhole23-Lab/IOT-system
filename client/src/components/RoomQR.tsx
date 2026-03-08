import { QRCodeSVG } from 'qrcode.react'

interface RoomQRProps {
  code: string
  type: 'teach' | 'test'
  size?: number
}

export default function RoomQR({ code, type, size = 160 }: RoomQRProps) {
  const origin = window.location.origin
  const url    = `${origin}/${type}/student/${code}`

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="p-3 rounded-2xl bg-white shadow-card border border-slate-100">
        <QRCodeSVG
          value={url}
          size={size}
          bgColor="#ffffff"
          fgColor="#1e3a8a"
          level="M"
          includeMargin={false}
        />
      </div>
      <p className="text-xs text-slate-400 text-center max-w-[200px]">
        扫码直接进入{type === 'teach' ? '演示课堂' : '考试系统'}
      </p>
    </div>
  )
}
