const DAMAGE_BASE = 12;
const MULT = 0.3;
const MAX_MULT_LEVEL = 10;

const enemies = ['light', 'medium', 'heavy'] as const;
type Enemy = (typeof enemies)[number];

const ENEMY_HP: Record<Enemy, number> = {
    light: 30,
    medium: 50,
    heavy: 80,
};

const OFFSET = 7;
{
    const dmg = DAMAGE_BASE.toString().padStart(OFFSET, ' ');
    const mult = ((MULT * 100).toFixed(0) + '%').padStart(OFFSET, ' ');
    const enemyHpValues = enemies
        .map((e) => ENEMY_HP[e].toString().padStart(OFFSET, ' '))
        .join('|');
    console.log(`${mult}|${dmg}|${enemyHpValues}|`);
}

{
    const mult = 'Mult'.padStart(OFFSET, ' ');
    const dmg = 'Damage'.padStart(OFFSET, ' ');
    const enemyNames = enemies.map((e) => titleCase(e).padStart(OFFSET, ' ')).join('|');
    console.log(`${mult}|${dmg}|${enemyNames}|`);
}

{
    const separator = ('-'.repeat(OFFSET) + '|').repeat(enemies.length + 2);
    console.log(separator);
}

for (let level = 0; level <= MAX_MULT_LEVEL; level++) {
    const levelStr = `+${level}`.padStart(OFFSET, ' ');
    const damage = scaleDamage(DAMAGE_BASE, MULT, level);
    const damageStr = damage.toFixed(2).padStart(OFFSET, ' ');
    const hitsStr = enemies
        .map((enemy) => {
            const hp = ENEMY_HP[enemy];
            const hits = Math.ceil(hp / damage);
            const hitsStr = hits.toString().padStart(OFFSET, ' ');
            return hitsStr;
        })
        .join('|');
    console.log(`${levelStr}|${damageStr}|${hitsStr}|`);
}

function titleCase(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function scaleDamage(base: number, mult: number, level: number): number {
    let damage = base;
    for (let i = 0; i < level; i++) {
        damage *= 1 + mult;
    }
    return damage;
}
