
import type { Fqn, RelationID, ViewID, LayoutedView } from '@likec4/core/types'
import type { PanelToExtensionProtocol } from '../protocol'

const vscode = acquireVsCodeApi<{
  view: LayoutedView
}>()

const queueMicrotask = (cb: () => void) => void Promise.resolve().then(cb)

const sendToExtension = (msg: PanelToExtensionProtocol) => {
  queueMicrotask(() => {
    vscode.postMessage(msg)
  })
}

export const getPreviewWindowState = () => {
  return vscode.getState()?.view ?? null
}

export const savePreviewWindowState = (view: LayoutedView) => {
  vscode.setState({
    view
  })
}

export const closePreviewWindow = () => {
  sendToExtension({
    kind: 'close'
  })
}

export const imReady = () => {
  sendToExtension({
    kind: 'ready'
  })
}

export const openView = (viewId: ViewID) => {
  sendToExtension({
    kind: 'open',
    viewId
  })
}

export const goToSource = (element: Fqn) => {
  sendToExtension({
    kind: 'goToSource',
    element
  })
}

export const goToRelation = (relationId: RelationID) => {
  sendToExtension({
    kind: 'goToRelation',
    relationId
  })
}

export const goToViewSource = (viewId: ViewID) => {
  sendToExtension({
    kind: 'goToViewSource',
    viewId
  })
}
