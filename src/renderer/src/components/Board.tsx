import { Chessboard } from 'react-chessboard'

interface Props {
  fen: string
  orientation: 'white' | 'black'
  bestMoveUci?: string | null
  playedMoveUci?: string | null
  showBestArrow: boolean
}

export default function Board({
  fen,
  orientation,
  bestMoveUci,
  playedMoveUci,
  showBestArrow
}: Props): React.JSX.Element {
  const arrows: { startSquare: string; endSquare: string; color: string }[] = []
  if (showBestArrow && bestMoveUci && bestMoveUci.length >= 4) {
    arrows.push({
      startSquare: bestMoveUci.slice(0, 2),
      endSquare: bestMoveUci.slice(2, 4),
      color: 'rgba(129, 182, 76, 0.85)'
    })
  }

  const squareStyles: Record<string, React.CSSProperties> = {}
  if (playedMoveUci && playedMoveUci.length >= 4) {
    squareStyles[playedMoveUci.slice(0, 2)] = { backgroundColor: 'rgba(255, 213, 105, 0.35)' }
    squareStyles[playedMoveUci.slice(2, 4)] = { backgroundColor: 'rgba(255, 213, 105, 0.45)' }
  }

  return (
    <div className="board-wrap">
      <Chessboard
        options={{
          position: fen,
          boardOrientation: orientation,
          allowDragging: false,
          arrows,
          squareStyles,
          animationDurationInMs: 150,
          darkSquareStyle: { backgroundColor: '#767676' },
          lightSquareStyle: { backgroundColor: '#ececec' },
          boardStyle: { overflow: 'hidden' }
        }}
      />
    </div>
  )
}
