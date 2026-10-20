import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Avatar, iniciales } from './Avatar'
import { Button } from './Button'
import { Field } from './Field'
import { Input } from './Input'
import { StatusPill } from './StatusPill'
import { TimeSlot } from './TimeSlot'

describe('Button', () => {
  it('en carga queda deshabilitado y anuncia que está ocupado', () => {
    render(<Button loading>Guardar</Button>)
    const btn = screen.getByRole('button', { name: /guardar/i })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('aria-busy', 'true')
  })
  it('por defecto es type="button" para no enviar formularios sin querer', () => {
    render(<Button>Volver</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })
})

describe('Field', () => {
  it('conecta label, error e input', () => {
    render(
      <Field label="Teléfono" error="Falta el código de área">
        <Input />
      </Field>,
    )
    const input = screen.getByLabelText('Teléfono')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Falta el código de área')
  })
})

describe('StatusPill', () => {
  it('muestra el estado en texto, no solo en color', () => {
    render(<StatusPill estado="no_asistio" />)
    expect(screen.getByText('No asistió')).toBeInTheDocument()
  })
})

describe('TimeSlot', () => {
  it('un horario ocupado no se puede elegir', async () => {
    const onClick = vi.fn()
    render(<TimeSlot time="11:00" disabled onClick={onClick} />)
    await userEvent.click(screen.getByRole('button', { name: '11:00, ocupado' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('Avatar', () => {
  it('sin foto muestra iniciales y conserva el nombre accesible', () => {
    render(<Avatar name="Martín Sosa" />)
    expect(screen.getByText('MS')).toBeInTheDocument()
    expect(screen.getByText('Martín Sosa')).toBeInTheDocument()
    expect(iniciales('  lucas  ferreyra ibarra')).toBe('LF')
  })
})
