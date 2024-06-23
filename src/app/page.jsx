'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'

// Constants
const GAME_CONSTANTS = {
	DOT_SIZE: 30,
	BULLET_SPEED: 0.5,
	BULLET_SIZE: { width: 2, height: 30 },
	BULLET_DAMAGE: 10,
	MELEE_DAMAGE: 0.5,
	RECOIL_FORCE: 5,
	RECOIL_DURATION: 200,
	COOLDOWN_DURATION: 500,
	MELEE_ATTACK_DURATION: 200,
	MELEE_ATTACK_DISTANCE: 30,
	PLAYER_SPEED: 0.25,
}

const WEAPON_TYPES = {
	RANGED: 'ranged',
	MELEE: 'melee',
}

// Hooks
const useGameLoop = (callback) => {
	const requestRef = useRef()
	const previousTimeRef = useRef()

	const animate = (time) => {
		if (previousTimeRef.current !== undefined) {
			const deltaTime = time - previousTimeRef.current
			callback(deltaTime)
		}
		previousTimeRef.current = time
		requestRef.current = requestAnimationFrame(animate)
	}

	useEffect(() => {
		requestRef.current = requestAnimationFrame(animate)
		return () => cancelAnimationFrame(requestRef.current)
	}, [callback])
}

const useKeyPress = () => {
	const [pressedKeys, setPressedKeys] = useState(new Set())

	useEffect(() => {
		const handleKeyDown = (event) => {
			setPressedKeys((prevKeys) => new Set(prevKeys).add(event.key.toLowerCase()))
		}

		const handleKeyUp = (event) => {
			setPressedKeys((prevKeys) => {
				const newKeys = new Set(prevKeys)
				newKeys.delete(event.key.toLowerCase())
				return newKeys
			})
		}

		window.addEventListener('keydown', handleKeyDown)
		window.addEventListener('keyup', handleKeyUp)

		return () => {
			window.removeEventListener('keydown', handleKeyDown)
			window.removeEventListener('keyup', handleKeyUp)
		}
	}, [])

	return pressedKeys
}

// Components
const WeaponSelect = ({ onSelect }) => {
	return (
		<div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
			<h2 className="text-2xl font-bold mb-4">选择你的武器</h2>
			<div className="space-x-4">
				<button
					className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded transition duration-200"
					onClick={() => onSelect(WEAPON_TYPES.RANGED)}>
					远程武器
				</button>
				<button
					className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded transition duration-200"
					onClick={() => onSelect(WEAPON_TYPES.MELEE)}>
					近战武器
				</button>
			</div>
		</div>
	)
}

const Player = ({ x, y, size, color, health, isAiming, aimDirection, weaponType, meleeAttack }) => {
	const weaponLength = weaponType === WEAPON_TYPES.MELEE ? 40 : 30
	const weaponWidth = weaponType === WEAPON_TYPES.MELEE ? 4 : 2
	const weaponStartDistance = size / 2
	const aimLength = weaponLength / 2

	let weaponOffsetX = 0
	let weaponOffsetY = 0
	if (meleeAttack) {
		const progress = meleeAttack.progress
		const attackDistance = GAME_CONSTANTS.MELEE_ATTACK_DISTANCE
		if (progress <= 0.5) {
			weaponOffsetX = aimDirection.x * attackDistance * (progress * 2)
			weaponOffsetY = aimDirection.y * attackDistance * (progress * 2)
		} else {
			weaponOffsetX = aimDirection.x * attackDistance * ((1 - progress) * 2)
			weaponOffsetY = aimDirection.y * attackDistance * ((1 - progress) * 2)
		}
	}

	return (
		<>
			<div
				className="absolute rounded-full"
				style={{
					width: `${size}px`,
					height: `${size}px`,
					transform: `translate(${x}px, ${y}px)`,
					backgroundColor: color,
				}}
			/>
			<div
				className="absolute bg-red-500 h-1"
				style={{
					width: `${size * (health / 100)}px`,
					transform: `translate(${x}px, ${y - 5}px)`,
				}}
			/>
			{isAiming && (
				<>
					<div
						className="absolute bg-black"
						style={{
							width: `${aimLength}px`,
							height: `1px`,
							transform: `translate(${x + size / 2 + aimDirection.x * weaponStartDistance}px, 
                                    ${y + size / 2 + aimDirection.y * weaponStartDistance}px) 
                         rotate(${Math.atan2(aimDirection.y, aimDirection.x)}rad)`,
							transformOrigin: '0 50%',
						}}
					/>
					<div
						className={`absolute ${weaponType === WEAPON_TYPES.MELEE ? 'bg-red-500' : 'bg-blue-500'}`}
						style={{
							width: `${weaponLength}px`,
							height: `${weaponWidth}px`,
							transform: `translate(${x + size / 2 + aimDirection.x * weaponStartDistance + weaponOffsetX}px, 
                                    ${y + size / 2 + aimDirection.y * weaponStartDistance + weaponOffsetY}px) 
                         rotate(${Math.atan2(aimDirection.y, aimDirection.x)}rad)`,
							transformOrigin: '0 50%',
							transition: weaponType === WEAPON_TYPES.MELEE ? 'transform 0.05s linear' : 'none',
						}}
					/>
				</>
			)}
		</>
	)
}

const Bullet = ({ bullet }) => {
	return (
		<div
			className="absolute bg-black"
			style={{
				width: `${GAME_CONSTANTS.BULLET_SIZE.height}px`,
				height: `${GAME_CONSTANTS.BULLET_SIZE.width}px`,
				transform: `translate(${bullet.x - GAME_CONSTANTS.BULLET_SIZE.height / 2}px, 
                             ${bullet.y - GAME_CONSTANTS.BULLET_SIZE.width / 2}px) 
                   rotate(${Math.atan2(bullet.vy, bullet.vx)}rad)`,
				transformOrigin: '50% 50%',
			}}
		/>
	)
}

// Main Game Component
const MovableDot = () => {
	const [gameState, setGameState] = useState('weaponSelect')
	const [weaponType, setWeaponType] = useState(null)
	const [player, setPlayer] = useState({ x: 0, y: 0, health: 100 })
	const [dummy, setDummy] = useState({ x: 300, y: 300, health: 100 })
	const [aimDirection, setAimDirection] = useState({ x: 1, y: 0 })
	const [bullets, setBullets] = useState([])
	const [meleeAttack, setMeleeAttack] = useState(null)
	const [recoil, setRecoil] = useState({ x: 0, y: 0, time: 0 })
	const [cooldown, setCooldown] = useState(0)
	const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

	const pressedKeys = useKeyPress()

	const updateAimDirection = useCallback(() => {
		const dotCenterX = player.x + GAME_CONSTANTS.DOT_SIZE / 2
		const dotCenterY = player.y + GAME_CONSTANTS.DOT_SIZE / 2
		const dx = mousePosition.x - dotCenterX
		const dy = mousePosition.y - dotCenterY
		const length = Math.sqrt(dx * dx + dy * dy)
		setAimDirection({
			x: dx / length,
			y: dy / length,
		})
	}, [player, mousePosition])

	const handleWeaponSelect = useCallback((weapon) => {
		setWeaponType(weapon)
		setGameState('playing')
	}, [])

	const updatePlayerPosition = useCallback(
		(deltaTime) => {
			setPlayer((prev) => {
				let newX = prev.x
				let newY = prev.y

				if (recoil.time > 0) {
					// 修改这里：远程武器后座力方向反转
					const recoilDirection = weaponType === WEAPON_TYPES.RANGED ? -1 : 1
					newX += recoil.x * recoilDirection * (deltaTime / GAME_CONSTANTS.RECOIL_DURATION)
					newY += recoil.y * recoilDirection * (deltaTime / GAME_CONSTANTS.RECOIL_DURATION)
					setRecoil((prevRecoil) => ({
						...prevRecoil,
						time: Math.max(0, prevRecoil.time - deltaTime),
					}))
				}

				let moveX = 0
				let moveY = 0
				if (pressedKeys.has('w')) moveY -= 1
				if (pressedKeys.has('s')) moveY += 1
				if (pressedKeys.has('a')) moveX -= 1
				if (pressedKeys.has('d')) moveX += 1

				const moveMagnitude = Math.sqrt(moveX * moveX + moveY * moveY)
				if (moveMagnitude > 0) {
					moveX /= moveMagnitude
					moveY /= moveMagnitude
				}

				const dotProduct = moveX * recoil.x + moveY * recoil.y
				const recoilMagnitude = Math.sqrt(recoil.x * recoil.x + recoil.y * recoil.y)
				const angleCos = recoilMagnitude > 0 ? dotProduct / recoilMagnitude : 0

				let adjustedSpeed = GAME_CONSTANTS.PLAYER_SPEED
				if (recoil.time > 0 && moveMagnitude > 0) {
					if (angleCos > 0.5) {
						adjustedSpeed *= 1.5
					} else if (angleCos < -0.5) {
						adjustedSpeed *= 0.5
					}
				}

				const moveDistance = adjustedSpeed * deltaTime
				newX += moveX * moveDistance
				newY += moveY * moveDistance

				newX = Math.max(0, Math.min(newX, window.innerWidth - GAME_CONSTANTS.DOT_SIZE))
				newY = Math.max(0, Math.min(newY, window.innerHeight - GAME_CONSTANTS.DOT_SIZE))

				return { ...prev, x: newX, y: newY }
			})
		},
		[recoil, pressedKeys]
	)

	const updateBullets = useCallback(
		(deltaTime) => {
			setBullets((prevBullets) => {
				const newBullets = prevBullets
					.map((bullet) => ({
						...bullet,
						x: bullet.x + bullet.vx * GAME_CONSTANTS.BULLET_SPEED * deltaTime,
						y: bullet.y + bullet.vy * GAME_CONSTANTS.BULLET_SPEED * deltaTime,
					}))
					.filter(
						(bullet) =>
							bullet.x + GAME_CONSTANTS.BULLET_SIZE.height > 0 &&
							bullet.x - GAME_CONSTANTS.BULLET_SIZE.height < window.innerWidth &&
							bullet.y + GAME_CONSTANTS.BULLET_SIZE.height > 0 &&
							bullet.y - GAME_CONSTANTS.BULLET_SIZE.height < window.innerHeight
					)

				newBullets.forEach((bullet) => {
					if (checkCollision(bullet, dummy, GAME_CONSTANTS.DOT_SIZE)) {
						setDummy((prev) => ({
							...prev,
							health: Math.max(0, prev.health - GAME_CONSTANTS.BULLET_DAMAGE),
						}))
						bullet.toRemove = true
					}
				})

				return newBullets.filter((bullet) => !bullet.toRemove)
			})
		},
		[dummy]
	)

	const updateMeleeAttack = useCallback(
		(deltaTime) => {
			if (meleeAttack) {
				setMeleeAttack((prev) => {
					if (prev.time <= 0) return null
					const newTime = prev.time - deltaTime
					const progress = 1 - newTime / GAME_CONSTANTS.MELEE_ATTACK_DURATION

					const playerCenterX = player.x + GAME_CONSTANTS.DOT_SIZE / 2
					const playerCenterY = player.y + GAME_CONSTANTS.DOT_SIZE / 2
					const dummyCenterX = dummy.x + GAME_CONSTANTS.DOT_SIZE / 2
					const dummyCenterY = dummy.y + GAME_CONSTANTS.DOT_SIZE / 2

					// 增加武器的有效范围
					const weaponReach = GAME_CONSTANTS.DOT_SIZE + 40 // 增加武器的有效范围
					const distance = Math.sqrt(
						(playerCenterX - dummyCenterX) ** 2 + (playerCenterY - dummyCenterY) ** 2
					)

					if (distance < weaponReach) {
						// 放宽判定条件，移除瞄准器移动的要求
						setDummy((prevDummy) => ({
							...prevDummy,
							health: Math.max(0, prevDummy.health - GAME_CONSTANTS.MELEE_DAMAGE * deltaTime),
						}))
					}

					return {
						...prev,
						time: newTime,
						progress: progress,
					}
				})
			}
		},
		[meleeAttack, player, dummy]
	)

	const gameLoop = useCallback(
		(deltaTime) => {
			if (gameState === 'playing') {
				updatePlayerPosition(deltaTime)
				updateAimDirection()
				if (weaponType === WEAPON_TYPES.RANGED) {
					updateBullets(deltaTime)
				} else if (weaponType === WEAPON_TYPES.MELEE) {
					updateMeleeAttack(deltaTime)
				}
				if (cooldown > 0) {
					setCooldown(Math.max(0, cooldown - deltaTime))
				}
			}
		},
		[
			gameState,
			weaponType,
			updatePlayerPosition,
			updateBullets,
			updateMeleeAttack,
			cooldown,
			updateAimDirection,
		]
	)

	useGameLoop(gameLoop)

	const checkCollision = (point, target, targetSize) => {
		const dx = point.x - (target.x + targetSize / 2)
		const dy = point.y - (target.y + targetSize / 2)
		return Math.sqrt(dx * dx + dy * dy) < targetSize / 2
	}

	useEffect(() => {
		const handleMouseMove = (event) => {
			setMousePosition({ x: event.clientX, y: event.clientY })
		}

		const handleClick = () => {
			if (cooldown === 0) {
				if (weaponType === WEAPON_TYPES.RANGED) {
					const bulletStartX = player.x + GAME_CONSTANTS.DOT_SIZE / 2
					const bulletStartY = player.y + GAME_CONSTANTS.DOT_SIZE / 2
					setBullets((prevBullets) => [
						...prevBullets,
						{
							x: bulletStartX,
							y: bulletStartY,
							vx: aimDirection.x,
							vy: aimDirection.y,
						},
					])
				} else if (weaponType === WEAPON_TYPES.MELEE) {
					setMeleeAttack({
						time: GAME_CONSTANTS.MELEE_ATTACK_DURATION,
						progress: 0,
					})
				}

				setRecoil({
					x: aimDirection.x * GAME_CONSTANTS.RECOIL_FORCE,
					y: aimDirection.y * GAME_CONSTANTS.RECOIL_FORCE,
					time: GAME_CONSTANTS.RECOIL_DURATION,
				})

				setCooldown(GAME_CONSTANTS.COOLDOWN_DURATION)
			}
		}

		window.addEventListener('mousemove', handleMouseMove)
		window.addEventListener('click', handleClick)

		return () => {
			window.removeEventListener('mousemove', handleMouseMove)
			window.removeEventListener('click', handleClick)
		}
	}, [cooldown, weaponType, player, aimDirection])

	if (gameState === 'weaponSelect') {
		return <WeaponSelect onSelect={handleWeaponSelect} />
	}

	return (
		<div className="h-screen w-screen bg-gray-100 relative overflow-hidden">
			<Player
				x={player.x}
				y={player.y}
				size={GAME_CONSTANTS.DOT_SIZE}
				color="blue"
				health={player.health}
				isAiming={true}
				aimDirection={aimDirection}
				weaponType={weaponType}
				meleeAttack={meleeAttack}
			/>
			<Player
				x={dummy.x}
				y={dummy.y}
				size={GAME_CONSTANTS.DOT_SIZE}
				color="red"
				health={dummy.health}
				isAiming={false}
			/>
			{weaponType === WEAPON_TYPES.RANGED &&
				bullets.map((bullet, index) => <Bullet key={index} bullet={bullet} />)}
			<div className="absolute top-4 left-4 text-gray-700">
				按住 WASD 鍵來移動點，移動鼠標來瞄準，點擊滑鼠左鍵
				{weaponType === WEAPON_TYPES.RANGED ? '发射子彈' : '进行近战攻击'}
			</div>
			{cooldown > 0 && (
				<div className="absolute top-4 right-4 text-red-500">冷卻中 ({(cooldown / 1000).toFixed(1)}s)</div>
			)}
		</div>
	)
}

export default MovableDot
