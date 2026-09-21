import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getNavConfig } from '../src/components/layout/navConfig'
const hasFee=(u:Parameters<typeof getNavConfig>[0])=>getNavConfig(u).sections.some(s=>s.items.some(i=>i.to==='/fee-calculator'))
test('수가 계산 메뉴는 ADMIN만 표시',()=>{
 assert.equal(hasFee({role:'ADMIN',position:'관리자'}),true)
 for(const position of ['시설장','대표','이사','사회복지사','요양보호사','외부담당','앨범담당','영양사'])assert.equal(hasFee({role:'STAFF',position,allowed_menus:['/fee-calculator']}),false)
 assert.equal(hasFee(null),false)
})
