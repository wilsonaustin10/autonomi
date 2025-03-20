
'use client'

export default function TestPage() {
    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        console.log(e.clientX, e.clientY)
        const rect = e.currentTarget.getBoundingClientRect();
        console.log(rect.left, rect.top, rect.width, rect.height);
    }
    return (
        <div className="w-screen h-[200vh] flex items-center justify-center" onClick={handleClick}>
            <div className="w-10 h-10 bg-red-500" onClick={handleClick}></div>
        </div>
    )
}
