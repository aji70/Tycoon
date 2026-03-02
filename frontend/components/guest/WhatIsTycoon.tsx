import React from 'react'

const WhatIsTycoon = () => {
    return (
        <section className="w-full relative px-4 py-12 md:py-16 bg-[#010F10]">
            <div className="w-full max-w-[1100px] mx-auto game-panel rounded-xl bg-[#0B191A]/80 backdrop-blur-sm border border-[#003B3E]/60 px-6 md:px-10 py-10 md:py-14 relative overflow-hidden">
                {/* Decorative corner gradient */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[#00F0FF]/10 to-transparent rounded-full blur-2xl pointer-events-none" aria-hidden />
                <main className="relative flex flex-col justify-center items-center lg:flex-row lg:items-center gap-8">
                    <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
                        <span className="game-badge mb-4">RULEBOOK</span>
                        <h2 className="game-section-title lg:text-[48px] md:text-[40px] text-[32px] leading-tight text-[#F0F7F7]">
                            What is Tycoon
                        </h2>
                    </div>
                    <p className="font-dmSans font-[400] text-[16px] md:text-[18px] text-[#E0F7F8] -tracking-[2%] leading-relaxed max-w-xl border-l-2 border-[#00F0FF]/50 pl-6">
                        Tycoon is a fun digital board game where you collect tokens, trade with others, and complete challenges to win, all powered by blockchain.
                    </p>
                </main>
            </div>
        </section>
    )
}

export default WhatIsTycoon