import test from 'node:test'
import assert from 'node:assert/strict'

import {
  containsMenuPath,
  findFirstMenuPath,
  normalizeBackendMenus,
} from '../src/utils/menu.js'

const registered = ['/workorder/list', '/system/user', '/system/role']

test('backend menus normalize recursively and retain only registered unique MENU paths', () => {
  const result = normalizeBackendMenus([
    {
      id: 'root',
      menuName: 'Root',
      menuType: 'DIR',
      children: [
        { id: 'button', menuType: 'BUTTON', path: '/workorder/list' },
        {
          id: 'nested',
          menuName: 'Nested',
          menuType: 'DIR',
          children: [
            { id: 'orders', menuName: 'Orders', menuType: 'MENU', path: 'workorder/list?x=1' },
            { id: 'duplicate', menuName: 'Duplicate', menuType: 'MENU', path: '/workorder/list' },
            { id: 'unknown', menuName: 'Unknown', menuType: 'MENU', path: '/not-registered' },
            { id: 'empty', menuName: 'Empty', menuType: 'MENU', path: ' ' },
          ],
        },
      ],
    },
    { id: 'empty-dir', menuName: 'Empty', menuType: 'DIR', children: [] },
    { id: 'users', menuName: 'Users', menuType: 'menu', path: '//system//user/' },
  ], registered)

  assert.deepEqual(result, [
    {
      id: 'root',
      menuName: 'Root',
      menuType: 'DIR',
      children: [{
        id: 'nested',
        menuName: 'Nested',
        menuType: 'DIR',
        children: [{
          id: 'orders',
          menuName: 'Orders',
          menuType: 'MENU',
          path: '/workorder/list',
          children: [],
        }],
      }],
    },
    {
      id: 'users',
      menuName: 'Users',
      menuType: 'MENU',
      path: '/system/user',
      children: [],
    },
  ])
})

test('recursive lookup finds the first accessible registered menu', () => {
  const menus = normalizeBackendMenus([
    {
      menuType: 'DIR',
      children: [
        { menuType: 'MENU', path: '/workorder/list' },
        { menuType: 'MENU', path: '/system/role' },
      ],
    },
  ], registered)

  assert.equal(findFirstMenuPath(menus), '/workorder/list')
  assert.equal(findFirstMenuPath(menus, (path) => path === '/system/role'), '/system/role')
  assert.equal(containsMenuPath(menus, '/system/role'), true)
  assert.equal(containsMenuPath(menus, '/system/menu'), false)
})
