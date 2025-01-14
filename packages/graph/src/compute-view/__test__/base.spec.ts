import { describe, expect, it } from 'vitest'
import { $include, computeView, fakeElements as elements, includeWildcard } from './fixture'

describe('base', () => {
  it('should be empty if no root and no rules', () => {
    const { nodes, edges } = computeView([])
    expect(nodes).toEqual([])
    expect(edges).toEqual([])
  })

  it('should show only root if no rules', () => {
    const { nodeIds, edges } = computeView('cloud', [])
    expect(nodeIds).toEqual(['cloud'])
    expect(edges).toEqual([])
  })

  it('should show root elements for `include *`', () => {
    const { nodes, nodeIds, edgeIds } = computeView([$include('*')])
    expect(nodeIds).toEqual(['support', 'customer', 'cloud', 'amazon'])
    expect(edgeIds).toEqual(['customer:cloud', 'support:cloud', 'cloud:amazon'])
    const [support, customer, cloud, amazon] = nodes
    expect(amazon).toMatchObject({
      outEdges: [],
      inEdges: ['cloud:amazon']
    })
    expect(cloud).toMatchObject({
      outEdges: ['cloud:amazon'],
      inEdges: expect.arrayContaining(['support:cloud', 'customer:cloud'])
    })
    expect(customer).toMatchObject({
      outEdges: ['customer:cloud'],
      inEdges: []
    })
    expect(support).toMatchObject({
      outEdges: ['support:cloud'],
      inEdges: []
    })
  })

  it('should return nodes in the same order as was in view', () => {
    const { nodeIds, edgeIds } = computeView([
      $include('customer'),
      $include('support'),
      $include('*')
    ])
    expect(nodeIds).toEqual(['support', 'customer', 'cloud', 'amazon'])
    expect(edgeIds).toEqual(['customer:cloud', 'support:cloud', 'cloud:amazon'])
  })

  it('should include elements without relations', () => {
    const { nodeIds, edgeIds } = computeView([$include('cloud.frontend'), $include('amazon.s3')])
    expect(nodeIds).toEqual(['cloud.frontend', 'amazon.s3'])
    expect(edgeIds).toEqual([])
  })
})
