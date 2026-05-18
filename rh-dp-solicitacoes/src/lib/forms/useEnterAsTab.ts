import type React from 'react'

type KeyboardEventLike = Pick<
  KeyboardEvent,
  'key' | 'shiftKey' | 'ctrlKey' | 'altKey' | 'metaKey' | 'target' | 'preventDefault'
> & {
  defaultPrevented?: boolean
}

type ReactKeyboardEventLike = React.KeyboardEvent<HTMLElement>

type FocusableElement = HTMLElement & {
  disabled?: boolean
  readOnly?: boolean
  type?: string
}

const FOCUSABLE_SELECTOR = [
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[role="combobox"]',
].join(', ')

const IGNORED_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
])

function getElementName(element: Element) {
  return element.tagName.toLowerCase()
}

function getInputType(element: Element) {
  return (element.getAttribute('type') ?? (element as FocusableElement).type ?? '').toLowerCase()
}

function hasOptOutAttribute(element: Element) {
  return (
    element.closest('[data-enter-ignore="true"]') !== null ||
    element.closest('[data-enter-submit="true"]') !== null
  )
}

function isDisabledOrReadonly(element: Element) {
  const field = element as FocusableElement
  return field.disabled === true || field.readOnly === true || element.hasAttribute('disabled') || element.hasAttribute('readonly')
}

function isHiddenElement(element: Element) {
  const type = getInputType(element)

  if (type === 'hidden' || element.hasAttribute('hidden') || element.getAttribute('aria-hidden') === 'true') {
    return true
  }

  const htmlElement = element as HTMLElement
  return htmlElement.offsetParent === null && htmlElement.getClientRects().length === 0
}

function hasOpenComboboxBehavior(element: Element) {
  const openElement = element.closest('[aria-expanded="true"]')
  return openElement !== null && (openElement.getAttribute('role') === 'combobox' || openElement.hasAttribute('aria-controls'))
}

export function isEnterAsTabEligibleTarget(target: EventTarget | null): target is HTMLElement {
  if (!target || !(target as Element).tagName) return false

  const element = target as HTMLElement
  const tagName = getElementName(element)

  if (hasOptOutAttribute(element) || isDisabledOrReadonly(element) || isHiddenElement(element)) return false
  if (hasOpenComboboxBehavior(element)) return false

  if (tagName === 'textarea' || tagName === 'button' || tagName === 'a') return false

  if (tagName === 'input' && IGNORED_INPUT_TYPES.has(getInputType(element))) {
    return false
  }

  return true
}

export function getEnterAsTabScope(target: HTMLElement) {
  const explicitScope = target.closest('[data-enter-as-tab="true"]')
  if (!explicitScope) return null

  return target.closest('form') ?? explicitScope
}

export function isVisibleFocusableElement(element: Element): element is HTMLElement {
  if (!(element as HTMLElement).focus) return false
  if (isDisabledOrReadonly(element) || isHiddenElement(element) || hasOptOutAttribute(element)) return false

  const tagName = getElementName(element)
  if (tagName === 'a' || tagName === 'button') return false
  if (tagName === 'textarea') return false

  if (tagName === 'input' && IGNORED_INPUT_TYPES.has(getInputType(element))) {
    return false
  }

  return true
}

function getTabIndex(element: HTMLElement) {
  const tabIndex = element.getAttribute('tabindex')
  if (tabIndex === null || tabIndex.trim() === '') return 0

  const parsed = Number(tabIndex)
  return Number.isFinite(parsed) ? parsed : 0
}

export function getFocusableElements(scope: Element) {
  const elements = Array.from(scope.querySelectorAll(FOCUSABLE_SELECTOR)).filter(isVisibleFocusableElement)

  return elements.sort((left, right) => {
    const leftTabIndex = getTabIndex(left)
    const rightTabIndex = getTabIndex(right)

    if (leftTabIndex === rightTabIndex) return 0
    if (leftTabIndex === 0) return 1
    if (rightTabIndex === 0) return -1
    return leftTabIndex - rightTabIndex
  })
}

export function handleEnterAsTab(event: KeyboardEventLike | ReactKeyboardEventLike) {
  if (event.key !== 'Enter') return
  if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return
  if (event.defaultPrevented) return

  const target = event.target
  if (!isEnterAsTabEligibleTarget(target)) return

  const scope = getEnterAsTabScope(target)
  if (!scope) return

  event.preventDefault()

  const focusableElements = getFocusableElements(scope)
  const currentIndex = focusableElements.indexOf(target)
  const nextElement = currentIndex >= 0 ? focusableElements[currentIndex + 1] : null

  if (nextElement) {
    nextElement.focus()
  }
}

export function useEnterAsTab<T extends HTMLElement>() {
  return {
    onKeyDown: handleEnterAsTab as React.KeyboardEventHandler<T>,
  }
}
