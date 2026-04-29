import { useMemo, useState } from 'react'

type MotorParams = {
  powerKw: string
  freqHz: string
  speedRpm: string
  voltageV: string
  currentA: string
}

type InverterProfile = {
  code: string
  brand: string
  label: string
  motor: MotorParams
}

const MODEL_LIBRARY: InverterProfile[] = [
  {
    code: 'SG50CX',
    brand: 'Sungrow',
    label: 'Sungrow SG50CX',
    motor: { powerKw: '45', freqHz: '50', speedRpm: '1470', voltageV: '380', currentA: '84' },
  },
  {
    code: 'SG110CX',
    brand: 'Sungrow',
    label: 'Sungrow SG110CX',
    motor: { powerKw: '90', freqHz: '50', speedRpm: '1480', voltageV: '380', currentA: '165' },
  },
  {
    code: 'GW50KN-MT',
    brand: 'GoodWe',
    label: 'GoodWe GW50KN-MT',
    motor: { powerKw: '45', freqHz: '50', speedRpm: '1470', voltageV: '380', currentA: '82' },
  },
  {
    code: 'SUN2000-50KTL',
    brand: 'Huawei',
    label: 'Huawei SUN2000-50KTL',
    motor: { powerKw: '45', freqHz: '50', speedRpm: '1470', voltageV: '380', currentA: '82' },
  },
  {
    code: 'SE33.3K',
    brand: 'SolarEdge',
    label: 'SolarEdge SE33.3K',
    motor: { powerKw: '30', freqHz: '50', speedRpm: '1460', voltageV: '380', currentA: '55' },
  },
]

const EMPTY_MOTOR: MotorParams = {
  powerKw: '',
  freqHz: '50',
  speedRpm: '',
  voltageV: '380',
  currentA: '',
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, '')
}

export default function InverterModelForm() {
  const [modelCode, setModelCode] = useState('')
  const [motor, setMotor] = useState<MotorParams>(EMPTY_MOTOR)
  const [copied, setCopied] = useState(false)

  const matchedProfile = useMemo(() => {
    const code = normalizeCode(modelCode)
    if (!code) return null
    return MODEL_LIBRARY.find((profile) => normalizeCode(profile.code) === code) || null
  }, [modelCode])

  const applyProfile = () => {
    if (!matchedProfile) return
    setMotor(matchedProfile.motor)
  }

  const copyChecklist = async () => {
    const lines = [
      `Model: ${modelCode || 'N/A'}`,
      '',
      '1) Chạy thử biến tần',
      '- Chế độ tự động MPPT: cấp điện, biến tần tự chạy MPPT.',
      '- Chế độ bàn phím MPPT: cài P00.01 = 0, dùng RUN/STOP, sau đó tắt nguồn và bật lại.',
      '',
      '2) Thông số động cơ',
      `- P02.01 = ${motor.powerKw || '...'} kW`,
      `- P02.02 = ${motor.freqHz || '...'} Hz`,
      `- P02.03 = ${motor.speedRpm || '...'} RPM`,
      `- P02.04 = ${motor.voltageV || '...'} V`,
      `- P02.05 = ${motor.currentA || '...'} A`,
      '',
      '3) Điều khiển ngoài',
      '- P05.05 = 0',
      '- P05.01 = 1 (S1-COM qua công tắc MPPT)',
      '- Sau khi cài đặt: tắt điện và bật lại.',
      '',
      '4) Chức năng năng lượng mặt trời',
      '- P15.05 = 40%',
      '- P15.23 = 100s',
      '- P15.24 = 100s',
      '- P15.29 = 0.1s',
    ]

    await navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-slate-900/70 p-5 shadow-xl shadow-black/10 backdrop-blur">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Model-based setup</div>
          <h3 className="mt-1 text-xl font-semibold text-white">Form thông số biến tần theo mã model</h3>
          <p className="mt-1 text-sm text-slate-400">Nhập mã model để điền nhanh thông số. Nếu model chưa có trong thư viện, vẫn nhập tay như bình thường.</p>
        </div>
        <button
          type="button"
          onClick={copyChecklist}
          className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-400/20"
        >
          {copied ? 'Đã copy checklist' : 'Copy checklist'}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <label className="text-xs uppercase tracking-[0.16em] text-slate-500">Mã model biến tần</label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              list="inverter-models"
              value={modelCode}
              onChange={(e) => setModelCode(e.target.value)}
              placeholder="Ví dụ: SG50CX"
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none placeholder:text-slate-500"
            />
            <datalist id="inverter-models">
              {MODEL_LIBRARY.map((item) => (
                <option key={item.code} value={item.code}>{item.label}</option>
              ))}
            </datalist>
            <button
              type="button"
              onClick={applyProfile}
              disabled={!matchedProfile}
              className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Điền theo model
            </button>
          </div>

          <div className="mt-3 text-sm text-slate-400">
            {matchedProfile ? (
              <span>
                Nhận diện: <span className="font-medium text-white">{matchedProfile.label}</span> ({matchedProfile.brand})
              </span>
            ) : (
              <span>Chưa có profile khớp tuyệt đối. Bạn có thể nhập tay các thông số bên dưới.</span>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/5 p-4">
          <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Thiết lập cố định</div>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-200">
            <li>P05.05 = 0</li>
            <li>P05.01 = 1</li>
            <li>P15.05 = 40%</li>
            <li>P15.23 = 100s</li>
            <li>P15.24 = 100s</li>
            <li>P15.29 = 0.1s</li>
          </ul>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-5">
        <ParamField label="P02.01 (kW)" value={motor.powerKw} onChange={(value) => setMotor((prev) => ({ ...prev, powerKw: value }))} />
        <ParamField label="P02.02 (Hz)" value={motor.freqHz} onChange={(value) => setMotor((prev) => ({ ...prev, freqHz: value }))} />
        <ParamField label="P02.03 (RPM)" value={motor.speedRpm} onChange={(value) => setMotor((prev) => ({ ...prev, speedRpm: value }))} />
        <ParamField label="P02.04 (V)" value={motor.voltageV} onChange={(value) => setMotor((prev) => ({ ...prev, voltageV: value }))} />
        <ParamField label="P02.05 (A)" value={motor.currentA} onChange={(value) => setMotor((prev) => ({ ...prev, currentA: value }))} />
      </div>

      <div className="mt-4 rounded-3xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300">
        <div className="font-medium text-white">Hướng dẫn chạy thử nhanh</div>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Chạy tự động MPPT: cấp điện, biến tần tự vào chế độ MPPT.</li>
          <li>Chạy bàn phím MPPT: cài P00.01 = 0, RUN/STOP thủ công, sau đó tắt nguồn đến khi tối màn hình rồi bật lại.</li>
          <li>Sau khi cài P05.05/P05.01: tắt điện và bật lại để nhận cấu hình điều khiển ngoài.</li>
        </ul>
      </div>
    </section>
  )
}

function ParamField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="text-xs uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none"
        placeholder="Nhập giá trị"
      />
    </div>
  )
}
