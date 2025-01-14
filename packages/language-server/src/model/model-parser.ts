import { InvalidModelError, invariant, isNonEmptyArray, nonexhaustive, type c4 } from '@likec4/core'
import type { AstNode, LangiumDocument } from 'langium'
import { getDocument } from 'langium'
import objectHash from 'object-hash'
import stripIndent from 'strip-indent'
import type {
  LikeC4LangiumDocument,
  ParsedAstElement,
  ParsedAstElementView,
  ParsedAstRelation
} from '../ast'
import {
  ElementViewOps,
  ast,
  cleanParsedModel,
  isLikeC4LangiumDocument,
  resolveRelationPoints,
  streamModel,
  toAutoLayout,
  toElementStyle,
  toElementStyleExcludeDefaults,
  toRelationshipStyleExcludeDefaults
} from '../ast'
import { elementRef, fqnElementRef } from '../elementRef'
import { logError, logWarnError, logger } from '../logger'
import type { LikeC4Services } from '../module'
import { printDocs } from '../utils'
import type { FqnIndex } from './fqn-index'

export type ModelParsedListener = () => void

export class LikeC4ModelParser {
  private fqnIndex: FqnIndex
  constructor(private services: LikeC4Services) {
    this.fqnIndex = services.likec4.FqnIndex
  }

  parse(doc: LangiumDocument | LangiumDocument[]) {
    const docs = Array.isArray(doc) ? doc : [doc]
    logger.debug(`[ModelParser] onValidated (${docs.length} docs)\n${printDocs(docs)}`)
    for (const doc of docs) {
      if (!isLikeC4LangiumDocument(doc)) {
        continue
      }
      try {
        this.parseLikeC4Document(doc)
      } catch (cause) {
        logError(new InvalidModelError(`Error parsing document ${doc.uri.toString()}`, { cause }))
      }
    }
  }

  protected parseLikeC4Document(doc: LikeC4LangiumDocument) {
    const { elements, relations, views, specification } = cleanParsedModel(doc)

    const specs = doc.parseResult.value.specification?.elements
    if (specs) {
      for (const { kind, style } of specs) {
        if (kind.name in specification.kinds) {
          logger.warn(`Duplicate specification for kind ${kind.name}`)
          continue
        }
        try {
          specification.kinds[kind.name as c4.ElementKind] = toElementStyleExcludeDefaults(
            style?.props
          )
        } catch (e) {
          logWarnError(e)
        }
      }
    }

    const relations_specs = doc.parseResult.value.specification?.relationships
    if (relations_specs) {
      for (const { kind, props } of relations_specs) {
        if (kind.name in specification.relationships) {
          logger.warn(`Duplicate specification for kind ${kind.name}`)
          continue
        }
        try {
          specification.relationships[kind.name as c4.RelationshipKind] = toRelationshipStyleExcludeDefaults(
            props
          )
        } catch (e) {
          logWarnError(e)
        }
      }
    }

    for (const el of streamModel(doc)) {
      if (ast.isElement(el)) {
        try {
          elements.push(this.parseElement(el))
        } catch (e) {
          logWarnError(e)
        }
        continue
      }
      if (ast.isRelation(el)) {
        try {
          relations.push(this.parseRelation(el))
        } catch (e) {
          logWarnError(e)
        }
        continue
      }
      nonexhaustive(el)
    }

    const docviews = doc.parseResult.value.views?.views
    if (docviews) {
      for (const view of docviews) {
        try {
          const v = this.parseElementView(view)
          ElementViewOps.writeId(view, v.id)
          views.push(v)
        } catch (e) {
          logWarnError(e)
        }
      }
    }
    // const prevHash = doc.c4hash ?? ''
    // doc.c4hash = c4hash(doc)
    // return prevHash !== doc.c4hash
  }

  private parseElement(astNode: ast.Element): ParsedAstElement {
    const id = this.resolveFqn(astNode)
    invariant(astNode.kind.ref, 'Element kind is not resolved: ' + astNode.name)
    const kind = astNode.kind.ref.name as c4.ElementKind
    const tags = this.convertTags(astNode.body)
    const stylePropsAst = astNode.body?.props.find(ast.isStyleProperties)?.props
    const styleProps = toElementStyleExcludeDefaults(stylePropsAst)
    const astPath = this.getAstNodePath(astNode)

    let [title, description, technology] = astNode.props

    const bodyProps =
      astNode.body?.props.filter((p): p is ast.ElementStringProperty =>
        ast.isElementStringProperty(p)
      ) ?? []

    title = title ?? bodyProps.find(p => p.key === 'title')?.value
    description = description ?? bodyProps.find(p => p.key === 'description')?.value
    technology = technology ?? bodyProps.find(p => p.key === 'technology')?.value

    const links = astNode.body?.props.filter(ast.isLinkProperty).map(p => p.value)

    return {
      id,
      kind,
      astPath,
      title: title ? stripIndent(title).trim() : astNode.name,
      ...(tags && { tags }),
      ...(links && isNonEmptyArray(links) && { links }),
      ...(technology && { technology }),
      ...(description && { description: stripIndent(description).trim() }),
      ...styleProps
    }
  }

  private parseRelation(astNode: ast.Relation): ParsedAstRelation {
    const coupling = resolveRelationPoints(astNode)
    const target = this.resolveFqn(coupling.target)
    const source = this.resolveFqn(coupling.source)
    const kind = astNode.kind?.ref?.name as c4.RelationshipKind
    const hashdata = {
      astPath: this.getAstNodePath(astNode),
      source,
      target,
   }
    const id = objectHash(hashdata) as c4.RelationID
    const title = astNode.title ?? astNode.body?.props.find(p => p.key === 'title')?.value ?? ''
    return {
      id,
      ...hashdata,
      ...(kind && { kind }),
      title
    }
  }

  private parseElementExpression(astNode: ast.ElementExpression): c4.ElementExpression {
    if (ast.isWildcardExpression(astNode)) {
      return {
        wildcard: true
      }
    }
    if (ast.isElementKindExpression(astNode)) {
      invariant(
        astNode.kind.ref,
        'ElementKindExpression kind is not resolved: ' + astNode.$cstNode?.text
      )
      return {
        elementKind: astNode.kind.ref.name as c4.ElementKind,
        isEqual: astNode.isEqual
      }
    }
    if (ast.isElementTagExpression(astNode)) {
      invariant(
        astNode.tag.ref,
        'ElementTagExpression tag is not resolved: ' + astNode.$cstNode?.text
      )
      return {
        elementTag: astNode.tag.ref.name as c4.Tag,
        isEqual: astNode.isEqual
      }
    }
    if (ast.isElementRefExpression(astNode)) {
      const element = elementRef(astNode.id)
      invariant(element, 'Element not found ' + astNode.id.$cstNode?.text)
      return {
        element: this.resolveFqn(element),
        isDescedants: astNode.isDescedants
      }
    }
    nonexhaustive(astNode)
  }

  private parseExpression(astNode: ast.Expression): c4.Expression {
    if (ast.isElementExpression(astNode)) {
      return this.parseElementExpression(astNode)
    }
    if (ast.isIncomingExpression(astNode)) {
      return {
        incoming: this.parseElementExpression(astNode.target)
      }
    }
    if (ast.isOutgoingExpression(astNode)) {
      return {
        outgoing: this.parseElementExpression(astNode.source)
      }
    }
    if (ast.isInOutExpression(astNode)) {
      return {
        inout: this.parseElementExpression(astNode.inout.target)
      }
    }
    if (ast.isRelationExpression(astNode)) {
      return {
        source: this.parseElementExpression(astNode.source),
        target: this.parseElementExpression(astNode.target)
      }
    }
    nonexhaustive(astNode)
  }

  private parseViewRule(astRule: ast.ViewRule): c4.ViewRule {
    if (ast.isViewRuleExpression(astRule)) {
      const exprs = astRule.expressions.map(n => this.parseExpression(n))
      return astRule.isInclude ? { include: exprs } : { exclude: exprs }
    }
    if (ast.isViewRuleStyle(astRule)) {
      const styleProps = toElementStyle(astRule.props)
      return {
        targets: astRule.targets.map(n => this.parseElementExpression(n)),
        style: {
          ...styleProps
        }
      }
    }
    if (ast.isViewRuleAutoLayout(astRule)) {
      return {
        autoLayout: toAutoLayout(astRule.direction)
      }
    }
    nonexhaustive(astRule)
  }

  private parseElementView(astNode: ast.ElementView): ParsedAstElementView {
    const body = astNode.body
    invariant(body, 'ElementView body is not defined')
    const astPath = this.getAstNodePath(astNode)
    let id = astNode.name
    if (!id) {
      const doc = getDocument(astNode).uri.toString()
      id = objectHash({
        doc,
        astPath
      }) as c4.ViewID
    }

    const title = body.props.find(p => p.key === 'title')?.value
    const description = body.props.find(p => p.key === 'description')?.value

    const tags = this.convertTags(body)
    const links = body.props.filter(ast.isLinkProperty).map(p => p.value)

    const basic: ParsedAstElementView = {
      id: id as c4.ViewID,
      astPath,
      ...(title && { title }),
      ...(description && { description }),
      ...(tags && { tags }),
      ...(isNonEmptyArray(links) && { links }),
      rules: body.rules.flatMap(n => {
        try {
          return this.parseViewRule(n)
        } catch (e) {
          logWarnError(e)
          return []
        }
      })
    }

    if ('viewOf' in astNode) {
      const viewOfEl = elementRef(astNode.viewOf)
      const viewOf = viewOfEl && this.resolveFqn(viewOfEl)
      invariant(viewOf, ' viewOf is not resolved: ' + astNode.$cstNode?.text)
      return {
        ...basic,
        viewOf
      }
    }

    if ('extends' in astNode) {
      const extendsView = astNode.extends.view.ref
      invariant(extendsView?.name, 'view extends is not resolved: ' + astNode.$cstNode?.text)
      return {
        ...basic,
        extends: extendsView.name as c4.ViewID
      }
    }

    return basic
  }

  protected resolveFqn(node: ast.Element | ast.ExtendElement) {
    if (ast.isExtendElement(node)) {
      return fqnElementRef(node.element)
    }
    const fqn = this.fqnIndex.getFqn(node)
    invariant(fqn, `Not indexed element: ${this.getAstNodePath(node)}`)
    return fqn
  }

  private getAstNodePath(node: AstNode) {
    return this.services.workspace.AstNodeLocator.getAstNodePath(node)
  }

  private convertTags<E extends { tags?: ast.Tags }>(withTags?: E) {
    if (!withTags) {
      return null
    }
    const tags = withTags.tags?.value.flatMap(({ ref }) => (ref ? (ref.name as c4.Tag) : []))
    return tags && isNonEmptyArray(tags) ? tags : null
  }
}