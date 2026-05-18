require('ts-node/register')
require('tsconfig-paths/register')
const assert = require('assert')

const {
  handleEnterAsTab,
  isEnterAsTabEligibleTarget,
} = require('../src/lib/forms/useEnterAsTab')

class FakeElement {
  constructor(tagName, attrs = {}) {
    this.tagName = tagName.toUpperCase()
    this.children = []
    this.parent = null
    this.focused = false
    this.disabled = attrs.disabled === true
    this.readOnly = attrs.readOnly === true || attrs.readonly === true
    this.type = attrs.type || ''
    this.attrs = { ...attrs }
    this.offsetParent = attrs.invisible ? null : {}
  }

  append(...children) {
    for (const child of children) {
      child.parent = this
      this.children.push(child)
    }
    return this
  }

  focus() {
    this.focused = true
    FakeElement.activeElement = this
  }

  getAttribute(name) {
    if (name === 'type') return this.type || this.attrs.type || null
    const value = this.attrs[name]
    return value === undefined ? null : String(value)
  }

  hasAttribute(name) {
    if (name === 'disabled') return this.disabled
    if (name === 'readonly') return this.readOnly
    return this.attrs[name] !== undefined
  }

  getClientRects() {
    return this.attrs.invisible ? [] : [{}]
  }

  closest(selector) {
    let current = this
    while (current) {
      if (selector === 'form' && current.tagName === 'FORM') return current
      if (selector === '[data-enter-as-tab="true"]' && current.attrs['data-enter-as-tab'] === 'true') return current
      if (selector === '[data-enter-ignore="true"]' && current.attrs['data-enter-ignore'] === 'true') return current
      if (selector === '[data-enter-submit="true"]' && current.attrs['data-enter-submit'] === 'true') return current
      if (selector === '[aria-expanded="true"]' && current.attrs['aria-expanded'] === 'true') return current
      current = current.parent
    }
    return null
  }

  querySelectorAll() {
    const result = []
    const visit = (node) => {
      for (const child of node.children) {
        const tag = child.tagName.toLowerCase()
        if (
          ['input', 'select', 'textarea', 'button'].includes(tag) ||
          child.attrs.tabindex !== undefined ||
          child.attrs.role === 'combobox'
        ) {
          result.push(child)
        }
        visit(child)
      }
    }
    visit(this)
    return result
  }
}

function keydown(target, overrides = {}) {
  return {
    key: 'Enter',
    shiftKey: false,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    defaultPrevented: false,
    target,
    prevented: false,
    preventDefault() {
      this.prevented = true
      this.defaultPrevented = true
    },
    ...overrides,
  }
}

function formWith(...fields) {
  return new FakeElement('form', { 'data-enter-as-tab': 'true' }).append(...fields)
}

function resetFocus(...fields) {
  FakeElement.activeElement = null
  fields.forEach((field) => {
    field.focused = false
  })
}

function run(name, fn) {
  try {
    fn()
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
}

run('Enter em input chama preventDefault e move foco para próximo input', () => {
  const first = new FakeElement('input', { type: 'text' })
  const second = new FakeElement('input', { type: 'email' })
  formWith(first, second)
  const event = keydown(first)

  handleEnterAsTab(event)

  assert.equal(event.prevented, true)
  assert.equal(second.focused, true)
})

run('Enter em textarea não chama preventDefault', () => {
  const textarea = new FakeElement('textarea')
  const next = new FakeElement('input', { type: 'text' })
  formWith(textarea, next)
  const event = keydown(textarea)

  handleEnterAsTab(event)

  assert.equal(event.prevented, false)
  assert.equal(next.focused, false)
})

run('Shift+Enter não move foco', () => {
  const first = new FakeElement('input', { type: 'text' })
  const second = new FakeElement('input', { type: 'text' })
  formWith(first, second)
  const event = keydown(first, { shiftKey: true })

  handleEnterAsTab(event)

  assert.equal(event.prevented, false)
  assert.equal(second.focused, false)
})

run('Ctrl+Enter não move foco', () => {
  const first = new FakeElement('input', { type: 'text' })
  const second = new FakeElement('input', { type: 'text' })
  formWith(first, second)
  const event = keydown(first, { ctrlKey: true })

  handleEnterAsTab(event)

  assert.equal(event.prevented, false)
  assert.equal(second.focused, false)
})

run('Enter em checkbox não move foco', () => {
  const checkbox = new FakeElement('input', { type: 'checkbox' })
  const next = new FakeElement('input', { type: 'text' })
  formWith(checkbox, next)
  const event = keydown(checkbox)

  handleEnterAsTab(event)

  assert.equal(event.prevented, false)
  assert.equal(next.focused, false)
})

run('Enter em radio não move foco', () => {
  const radio = new FakeElement('input', { type: 'radio' })
  const next = new FakeElement('input', { type: 'text' })
  formWith(radio, next)
  const event = keydown(radio)

  handleEnterAsTab(event)

  assert.equal(event.prevented, false)
  assert.equal(next.focused, false)
})

run('Enter em button não move foco', () => {
  const button = new FakeElement('button')
  const next = new FakeElement('input', { type: 'text' })
  formWith(button, next)
  const event = keydown(button)

  handleEnterAsTab(event)

  assert.equal(event.prevented, false)
  assert.equal(next.focused, false)
})

run('Campo disabled é ignorado ao avançar', () => {
  const first = new FakeElement('input', { type: 'text' })
  const disabled = new FakeElement('input', { type: 'text', disabled: true })
  const next = new FakeElement('input', { type: 'text' })
  formWith(first, disabled, next)
  const event = keydown(first)

  handleEnterAsTab(event)

  assert.equal(event.prevented, true)
  assert.equal(disabled.focused, false)
  assert.equal(next.focused, true)
})

run('Campo hidden é ignorado ao avançar', () => {
  const first = new FakeElement('input', { type: 'text' })
  const hidden = new FakeElement('input', { type: 'hidden' })
  const next = new FakeElement('input', { type: 'text' })
  formWith(first, hidden, next)
  const event = keydown(first)

  handleEnterAsTab(event)

  assert.equal(event.prevented, true)
  assert.equal(hidden.focused, false)
  assert.equal(next.focused, true)
})

run('Campo readonly é ignorado', () => {
  const readonly = new FakeElement('input', { type: 'text', readOnly: true })
  const next = new FakeElement('input', { type: 'text' })
  formWith(readonly, next)
  const event = keydown(readonly)

  handleEnterAsTab(event)

  assert.equal(isEnterAsTabEligibleTarget(readonly), false)
  assert.equal(event.prevented, false)
  assert.equal(next.focused, false)
})

run('data-enter-ignore impede comportamento', () => {
  const ignored = new FakeElement('input', { type: 'text', 'data-enter-ignore': 'true' })
  const next = new FakeElement('input', { type: 'text' })
  formWith(ignored, next)
  const event = keydown(ignored)

  handleEnterAsTab(event)

  assert.equal(event.prevented, false)
  assert.equal(next.focused, false)
})

run('data-enter-submit impede comportamento', () => {
  const submitInput = new FakeElement('input', { type: 'text', 'data-enter-submit': 'true' })
  const next = new FakeElement('input', { type: 'text' })
  formWith(submitInput, next)
  const event = keydown(submitInput)

  handleEnterAsTab(event)

  assert.equal(event.prevented, false)
  assert.equal(next.focused, false)
})

run('Último campo não envia formulário automaticamente', () => {
  FakeElement.activeElement = null
  const last = new FakeElement('input', { type: 'text' })
  formWith(last)
  const event = keydown(last)

  handleEnterAsTab(event)

  assert.equal(event.prevented, true)
  assert.equal(FakeElement.activeElement, null)
})

run('Ordem segue elementos visíveis e tabindex', () => {
  const third = new FakeElement('input', { type: 'text', tabindex: '3' })
  const first = new FakeElement('input', { type: 'text', tabindex: '1' })
  const invisible = new FakeElement('input', { type: 'text', tabindex: '2', invisible: true })
  const second = new FakeElement('input', { type: 'text', tabindex: '2' })
  formWith(third, first, invisible, second)
  const event = keydown(first)

  handleEnterAsTab(event)

  assert.equal(event.prevented, true)
  assert.equal(invisible.focused, false)
  assert.equal(second.focused, true)
})
