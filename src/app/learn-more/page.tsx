import React from 'react';
import {
  BookOpen,
  Radio,
  Sparkles,
  Disc,
  Film,
  Cpu,
  HeartHandshake,
  ChevronRight,
  Flame,
  Landmark,
  Layers,
  Music,
  Users,
  Compass,
  Mic,
  Palette,
  Footprints,
} from 'lucide-react';
import Link from 'next/link';
import { VoiceNarrationButton } from '@/components/ai/VoiceNarrationButton';

export const metadata = {
  title: 'Learn More · The Bronx and The Breakbeat Manifesto',
  description: 'The Bronx history, the breakbeat legacy, analog sampler lore, and the 8 Of Spades Works cultural ecosystem.',
};

const MANIFESTO_FULL_TEXT = `The Bronx: Where Hip-Hop Found a Home. Curated by 8 OF SPADES WORKS. Long before hip-hop became a global cultural force, it was a neighborhood phenomenon born in the streets, courtyards, community rooms, parks, and housing projects of the Bronx. Among the places that helped shape that emerging movement was The Bronx, a community that became an important gathering point for young people searching for something beyond the violence, economic hardship, and social pressures surrounding them. In the 1970s, The Bronx became more than a residential development. It became a cultural laboratory where music became a language, dance became expression, art became identity, and block parties became spaces where young people could compete, collaborate, create, and belong.`;

export default function LearnMorePage() {
  return (
    <div className="max-w-4xl mx-auto py-8 sm:py-12 space-y-10">
      {/* Hero Card with Dual Language Spoken Audio Narration */}
      <div className="relative overflow-hidden rounded-3xl glass-panel p-8 sm:p-12 border border-brand-gold/40 bg-gradient-to-br from-brand-gold/15 via-neutral-950 to-neutral-950 shadow-2xl">
        <div className="relative z-10 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-gold/15 border border-brand-gold/40 text-brand-gold text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Cultural Manifesto & Lineage</span>
            </div>

            {/* Nova Calm Voice Dual-Language Spoken Narration (English & Spanish) */}
            <VoiceNarrationButton
              text={MANIFESTO_FULL_TEXT}
              variant="dual"
            />
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight font-display">
            The Manifesto of the Break
          </h1>
          <p className="text-sm sm:text-base text-neutral-300 max-w-2xl leading-relaxed">
            The Bronx, Samplers, and the New Era • Curated by 8 OF SPADES WORKS
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {/* Main Essay: The Bronx: Where Hip-Hop Found a Home */}
        <section className="glass-panel p-6 sm:p-8 rounded-3xl border border-brand-gold/30 bg-neutral-900/50 space-y-6 hover:border-brand-gold/50 transition-colors">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-brand-gold/20 text-brand-gold border border-brand-gold/30">
                <Landmark className="w-5 h-5" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                The Bronx: Where Hip-Hop Found a Home
              </h2>
            </div>
            <VoiceNarrationButton
              text="The Bronx: Where Hip-Hop Found a Home. Long before hip-hop became a global cultural force, it was a neighborhood phenomenon born in the streets, courtyards, community rooms, parks, and housing projects of the Bronx. Among the places that helped shape that emerging movement was The Bronx, a community that became an important gathering point for young people searching for something beyond the violence, economic hardship, and social pressures surrounding them. In the 1970s, The Bronx became more than a residential development. It became a cultural laboratory. Here, music became a language. Dance became expression. Art became identity. And block parties became spaces where young people could compete, collaborate, create, and belong."
              variant="icon"
            />
          </div>

          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            Long before hip-hop became a global cultural force, it was a neighborhood phenomenon—born in the streets, courtyards, community rooms, parks, and housing projects of the Bronx. Among the places that helped shape that emerging movement was The Bronx, a community that became an important gathering point for young people searching for something beyond the violence, economic hardship, and social pressures surrounding them.
          </p>

          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            In the 1970s, The Bronx became more than a residential development. It became a cultural laboratory.
          </p>

          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            Here, music became a language. Dance became expression. Art became identity. And block parties became spaces where young people could compete, collaborate, create, and—perhaps most importantly—belong.
          </p>
        </section>

        {/* Section: The Bronx Years */}
        <section className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/5 bg-neutral-900/40 space-y-4 hover:border-brand-purple/40 transition-colors">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-brand-purple/20 text-brand-purple border border-brand-purple/30">
                <Flame className="w-5 h-5" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                The Bronx Years
              </h2>
            </div>
            <VoiceNarrationButton
              text="The Bronx Years. The Bronx of the 1970s was experiencing profound social and economic upheaval. Neighborhoods faced disinvestment, unemployment, poverty, political neglect, and escalating street violence. Yet beneath those conditions, another story was developing: young people were constructing their own culture. In The Bronx, community gatherings, parties, jams, and neighborhood events created opportunities for DJs, MCs, dancers, artists, and music enthusiasts to experiment with new sounds and forms of expression. The turntables became instruments. The microphone became a megaphone. The dance floor became a stage. And the walls became canvases."
              variant="icon"
            />
          </div>

          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            The Bronx of the 1970s was experiencing profound social and economic upheaval. Neighborhoods faced disinvestment, unemployment, poverty, political neglect, and escalating street violence. Yet beneath those conditions, another story was developing.
          </p>

          <p className="text-sm sm:text-base text-brand-gold font-semibold leading-relaxed">
            Young people were constructing their own culture.
          </p>

          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            In The Bronx, community gatherings, parties, jams, and neighborhood events created opportunities for DJs, MCs, dancers, artists, and music enthusiasts to experiment with new sounds and forms of expression.
          </p>

          <ul className="space-y-2 pl-2 text-sm sm:text-base text-neutral-300">
            <li className="flex items-center gap-2.5">
              <span className="text-brand-gold">•</span>
              <span>The turntables became instruments.</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="text-brand-gold">•</span>
              <span>The microphone became a megaphone.</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="text-brand-gold">•</span>
              <span>The dance floor became a stage.</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="text-brand-gold">•</span>
              <span>And the walls became canvases.</span>
            </li>
          </ul>

          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            The culture emerging from these environments did not require expensive studios, corporate backing, or institutional permission. It required imagination, equipment, community, and an audience willing to participate.
          </p>

          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed font-medium">
            That independence would become one of hip-hop's defining characteristics.
          </p>
        </section>

        {/* Section: From Neighborhood Energy to a Cultural Movement */}
        <section className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/5 bg-neutral-900/40 space-y-4 hover:border-brand-neon/40 transition-colors">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-brand-neon/20 text-brand-neon border border-brand-neon/30">
                <Users className="w-5 h-5" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                From Neighborhood Energy to a Cultural Movement
              </h2>
            </div>
            <VoiceNarrationButton
              text="From Neighborhood Energy to a Cultural Movement. A grassroots cultural movement emerged within this larger Bronx ecosystem, becoming associated with a philosophy that sought to redirect youthful energy toward creativity, knowledge, music, dance, art, and community. Its significance was larger than any single party or neighborhood gathering. This movement represented an idea: that the same young people who were being described through the language of gangs, violence, and social disorder could instead become DJs, MCs, dancers, artists, organizers, thinkers, and cultural leaders."
              variant="icon"
            />
          </div>

          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            A grassroots cultural movement emerged within this larger Bronx ecosystem, becoming associated with a philosophy that sought to redirect youthful energy toward creativity, knowledge, music, dance, art, and community.
          </p>

          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            Its significance was larger than any single party or neighborhood gathering.
          </p>

          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            This movement represented an idea: that the same young people who were being described through the language of gangs, violence, and social disorder could instead become DJs, MCs, dancers, artists, organizers, thinkers, and cultural leaders.
          </p>

          <p className="text-sm sm:text-base text-brand-gold font-semibold leading-relaxed">
            That distinction mattered.
          </p>

          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            Hip-hop was not simply a new style of music. It was becoming a social language through which young people could tell their own stories and define themselves on their own terms.
          </p>
        </section>

        {/* Section: The Four Pillars */}
        <section className="glass-panel p-6 sm:p-8 rounded-3xl border border-brand-gold/30 bg-neutral-900/50 space-y-6 hover:border-brand-gold/50 transition-colors">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-brand-gold/20 text-brand-gold border border-brand-gold/30">
                <Layers className="w-5 h-5" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                The Four Pillars
              </h2>
            </div>
            <VoiceNarrationButton
              text="The Four Pillars. As hip-hop culture developed, four artistic disciplines increasingly became recognized as central components of the movement: DJing, manipulating records, rhythms, breaks, samples, and sound. MCing, using rhythm, poetry, storytelling, improvisation, and lyrical competition. Breaking, transforming the dance floor into athleticism, creativity, and individuality. And Graffiti, turning public spaces into visual expressions of identity, style, and reputation. Together, these disciplines created something unprecedented."
              variant="icon"
            />
          </div>

          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            As hip-hop culture developed, four artistic disciplines increasingly became recognized as central components of the movement:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-neutral-950/60 border border-white/5 space-y-1.5">
              <div className="flex items-center gap-2 text-brand-gold font-bold text-sm">
                <Disc className="w-4 h-4" />
                <span>DJing</span>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                Manipulating records, rhythms, breaks, samples, and sound to create new musical experiences.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-950/60 border border-white/5 space-y-1.5">
              <div className="flex items-center gap-2 text-brand-neon font-bold text-sm">
                <Mic className="w-4 h-4" />
                <span>MCing</span>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                Using rhythm, poetry, storytelling, improvisation, and lyrical competition to command the microphone.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-950/60 border border-white/5 space-y-1.5">
              <div className="flex items-center gap-2 text-brand-purple font-bold text-sm">
                <Footprints className="w-4 h-4" />
                <span>Breaking</span>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                Transforming the dance floor into a place of athleticism, creativity, individuality, and competition.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-950/60 border border-white/5 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <Palette className="w-4 h-4" />
                <span>Graffiti</span>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                Turning public spaces into visual expressions of identity, style, reputation, and artistic ambition.
              </p>
            </div>
          </div>

          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            Together, these disciplines created something unprecedented. A DJ could provide the soundtrack. An MC could provide the narrative. A breaker could translate the rhythm into movement. A graffiti writer could transform the visual landscape.
          </p>

          <p className="text-sm sm:text-base text-white font-bold leading-relaxed">
            The result was not merely entertainment. It was culture.
          </p>
        </section>

        {/* Section: Peace, Unity, Love and Having Fun */}
        <section className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/5 bg-neutral-900/40 space-y-4 hover:border-brand-purple/40 transition-colors">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-brand-purple/20 text-brand-purple border border-brand-purple/30">
                <HeartHandshake className="w-5 h-5" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                Peace, Unity, Love and Having Fun
              </h2>
            </div>
            <VoiceNarrationButton
              text="Peace, Unity, Love and Having Fun. One of the most enduring ideas of the early hip-hop movement was the philosophy of Peace, Unity, Love, and Having Fun. In a city where neighborhood rivalries and street conflicts could divide communities, the concept offered an alternative: competition did not have to end in violence. It could happen on the dance floor, through the microphone, through turntables, and through art. The battle could become creative rather than destructive."
              variant="icon"
            />
          </div>

          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            One of the most enduring ideas of the early hip-hop movement was the philosophy of “Peace, Unity, Love, and Having Fun.”
          </p>

          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            In a city where neighborhood rivalries and street conflicts could divide communities, the concept offered an alternative.
          </p>

          <ul className="space-y-2 pl-2 text-sm sm:text-base text-neutral-300">
            <li className="flex items-center gap-2.5">
              <span className="text-brand-gold">•</span>
              <span>Competition did not have to end in violence.</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="text-brand-gold">•</span>
              <span>It could happen on the dance floor.</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="text-brand-gold">•</span>
              <span>It could happen through the microphone.</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="text-brand-gold">•</span>
              <span>It could happen through turntables.</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="text-brand-gold">•</span>
              <span>It could happen through art.</span>
            </li>
          </ul>

          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            The battle could become creative rather than destructive. That transformation became one of hip-hop's most consequential contributions to American culture.
          </p>
        </section>

        {/* Section: The Bronx as Cultural Infrastructure */}
        <section className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/5 bg-neutral-900/40 space-y-4 hover:border-brand-gold/40 transition-colors">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-brand-gold/20 text-brand-gold border border-brand-gold/30">
                <Compass className="w-5 h-5" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                The Bronx as Cultural Infrastructure
              </h2>
            </div>
            <VoiceNarrationButton
              text="The Bronx as Cultural Infrastructure. It is easy, decades later, to look back at hip-hop through the lens of major record labels, stadium concerts, streaming platforms, and global brands. But the culture was built long before any of those institutions recognized its commercial potential. It was built in neighborhoods, by people, and through repeated gatherings where experimentation could take place in public. The Bronx became part of that infrastructure."
              variant="icon"
            />
          </div>

          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            It is easy, decades later, to look back at hip-hop through the lens of major record labels, platinum albums, stadium concerts, streaming platforms, and global fashion brands.
          </p>

          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            But the culture was built long before any of those institutions recognized its commercial potential.
          </p>

          <ul className="space-y-1.5 pl-2 text-sm sm:text-base text-neutral-300">
            <li className="flex items-center gap-2.5">
              <span className="text-brand-gold">•</span>
              <span>It was built in neighborhoods.</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="text-brand-gold">•</span>
              <span>It was built by people.</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="text-brand-gold">•</span>
              <span>And it was built through repeated gatherings where experimentation could take place in public.</span>
            </li>
          </ul>

          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            The Bronx became part of that infrastructure. The borough was not merely a backdrop to hip-hop history. It was part of the environment in which the culture developed—an ecosystem where music, dance, art, neighborhood identity, and youth expression could intersect.
          </p>

          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            Community jams and parties provided something increasingly rare in the urban landscape: a place where young people could gather around creativity. Those gatherings helped establish networks where DJs met other DJs, MCs encountered new audiences, dancers developed styles, artists found inspiration, and young people discovered that cultural influence could emerge from their own blocks.
          </p>
        </section>

        {/* Section: The Sound of a Generation */}
        <section className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/5 bg-neutral-900/40 space-y-4 hover:border-brand-neon/40 transition-colors">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-brand-neon/20 text-brand-neon border border-brand-neon/30">
                <Music className="w-5 h-5" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                The Sound of a Generation
              </h2>
            </div>
            <VoiceNarrationButton
              text="The Sound of a Generation. The music developing around these gatherings reflected the technological possibilities of the era: records became raw material, breakbeats became building blocks, two turntables became a laboratory, and a microphone could transform an unknown voice into the center of a crowd's attention. But its earliest power came from something much simpler: people gathered, someone played a record, someone grabbed a microphone, someone stepped onto the floor, and everyone else responded."
              variant="icon"
            />
          </div>

          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            The music developing around these gatherings reflected the technological possibilities of the era.
          </p>

          <ul className="space-y-1.5 pl-2 text-sm sm:text-base text-neutral-300">
            <li className="flex items-center gap-2.5">
              <span className="text-brand-gold">•</span>
              <span>Records became raw material.</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="text-brand-gold">•</span>
              <span>Breakbeats became building blocks.</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="text-brand-gold">•</span>
              <span>Two turntables could become a laboratory.</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="text-brand-gold">•</span>
              <span>A microphone could transform an unknown voice into the center of a crowd's attention.</span>
            </li>
          </ul>

          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            This spirit of experimentation would eventually help propel hip-hop from neighborhood parties into radio, record stores, television, film, fashion, advertising, and eventually every major corner of global popular culture.
          </p>

          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            But its earliest power came from something much simpler: people gathered, someone played a record, someone grabbed a microphone, someone stepped onto the floor, and everyone else responded.
          </p>
        </section>

        {/* Section: More Than Music */}
        <section className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/5 bg-neutral-900/40 space-y-4 hover:border-brand-purple/40 transition-colors">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-brand-purple/20 text-brand-purple border border-brand-purple/30">
                <BookOpen className="w-5 h-5" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                More Than Music
              </h2>
            </div>
            <VoiceNarrationButton
              text="More Than Music. The historical importance of The Bronx lies partly in what it reveals about the origins of hip-hop itself: it was never only about records. It was about community, identity, competition without destruction, and transforming limited resources into unlimited creativity. Culture does not always begin in institutions; sometimes it begins with young people creating something because they need a way to express themselves."
              variant="icon"
            />
          </div>

          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            The historical importance of The Bronx lies partly in what it reveals about the origins of hip-hop itself.
          </p>

          <ul className="space-y-1.5 pl-2 text-sm sm:text-base text-neutral-300">
            <li className="flex items-center gap-2.5">
              <span className="text-brand-gold">•</span>
              <span>Hip-hop was never only about records.</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="text-brand-gold">•</span>
              <span>It was about community.</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="text-brand-gold">•</span>
              <span>It was about identity.</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="text-brand-gold">•</span>
              <span>It was about competition without destruction.</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="text-brand-gold">•</span>
              <span>It was about transforming limited resources into unlimited creativity.</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="text-brand-gold">•</span>
              <span>And it was about young people refusing to allow difficult circumstances to dictate the boundaries of their imagination.</span>
            </li>
          </ul>

          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            That may be the most important lesson of the Bronx's hip-hop story: culture does not always begin in institutions. Sometimes it begins in places that institutions have overlooked. Sometimes it begins with young people creating something because they need a way to express themselves. And sometimes a neighborhood becomes the laboratory for an idea that eventually changes the world.
          </p>
        </section>

        {/* Section: The Legacy of The Bronx */}
        <section className="glass-panel p-6 sm:p-8 rounded-3xl border border-brand-gold/40 bg-gradient-to-r from-brand-purple/20 via-neutral-950 to-brand-gold/10 space-y-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-brand-gold/20 text-brand-gold border border-brand-gold/30">
                <Sparkles className="w-5 h-5" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                The Legacy of The Bronx
              </h2>
            </div>
            <VoiceNarrationButton
              text="The Legacy of The Bronx. Today, hip-hop is a multibillion-dollar global industry and one of America's most influential cultural exports. Yet beneath the global phenomenon remains the memory of The Bronx, places where the culture was not manufactured for a market, but was lived, danced, written, performed, argued over, shared, and passed from one generation to another. The Bronx supplied the streets. Young people supplied the imagination. Music supplied the rhythm. And a movement emerged. Decades later, the echoes are still everywhere. The beat goes on."
              variant="icon"
            />
          </div>

          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            Today, hip-hop is a multibillion-dollar global industry and one of America's most influential cultural exports. Its vocabulary has entered mainstream language. Its rhythms have influenced virtually every major genre of popular music. Its aesthetics have transformed fashion, advertising, film, sports, technology, and entertainment.
          </p>

          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            Yet beneath the global phenomenon remains the memory of The Bronx: places where the culture was not manufactured for a market.
          </p>

          <ul className="space-y-1.5 pl-2 text-sm sm:text-base text-neutral-300">
            <li className="flex items-center gap-2.5">
              <span className="text-brand-gold">•</span>
              <span>It was lived.</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="text-brand-gold">•</span>
              <span>It was danced.</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="text-brand-gold">•</span>
              <span>It was written.</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="text-brand-gold">•</span>
              <span>It was performed.</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="text-brand-gold">•</span>
              <span>It was argued over.</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="text-brand-gold">•</span>
              <span>It was shared.</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="text-brand-gold">•</span>
              <span>And it was passed from one generation to another.</span>
            </li>
          </ul>

          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            The story of The Bronx is therefore not simply a story about where hip-hop happened. It is a story about what can happen when a community creates its own cultural infrastructure.
          </p>

          <p className="text-base sm:text-lg text-brand-gold font-bold leading-relaxed">
            The Bronx supplied the streets. Young people supplied the imagination. Music supplied the rhythm. And a movement emerged.
          </p>

          <p className="text-sm sm:text-base text-white font-medium leading-relaxed">
            Decades later, the echoes are still everywhere. The beat goes on.
          </p>
        </section>

        {/* Section: The Analog Instruments of Revolution */}
        <section className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/5 bg-neutral-900/40 space-y-4 hover:border-brand-neon/40 transition-colors">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-brand-neon/20 text-brand-neon border border-brand-neon/30">
                <Cpu className="w-5 h-5" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                The Analog Instruments of Revolution
              </h2>
            </div>
            <VoiceNarrationButton
              text="When the E-mu SP-1200 arrived in 1987, followed closely by Roger Linns Akai MPC60, producers gained the power to capture twelve-bit analog slices of vinyl history. By pitching records up to forty-five RPM during recording and tuning them down inside the sampler, pioneers unlocked a crunchy, saturated transient snap that defined golden-era hip-hop and transatlantic rave music. 8 Of Spades Works is dedicated to honoring this uninterrupted legacy."
              variant="icon"
            />
          </div>
          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            When the E-mu SP-1200 arrived in 1987, followed closely by Roger Linns Akai MPC60, producers gained the power to capture twelve-bit analog slices of vinyl history. By pitching records up to forty-five RPM during recording and tuning them down inside the sampler, pioneers unlocked a crunchy, saturated transient snap that defined golden-era hip-hop and transatlantic rave music.
          </p>
          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            8 Of Spades Works is dedicated to honoring this uninterrupted legacy. We reject sterile algorithms that flatten sonic nuance. Instead, we combine authentic crate-digging reverence with next-generation agentic intelligence to celebrate the musicians, the diggers, the producers, and the timeless magic of the break.
          </p>
        </section>

        {/* Section: The Living Ecosystem */}
        <section className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/5 bg-neutral-900/40 space-y-6 hover:border-brand-purple/40 transition-colors">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-brand-purple/20 text-brand-purple border border-brand-purple/30">
                <HeartHandshake className="w-5 h-5" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                The Living Ecosystem
              </h2>
            </div>
            <VoiceNarrationButton
              text="8 Of Spades Works unites all dimensions of the culture under a single operating system: High-Definition Streaming with dynamic tempo matching, Cultural Documentaries and archival park jam footage, Narrated Audiobooks tracking sampling history, and Limited Heavyweight Vinyl artifacts."
              variant="icon"
            />
          </div>
          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            8 Of Spades Works unites all dimensions of the culture under a single operating system:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-neutral-950/60 border border-white/5 space-y-1.5">
              <div className="flex items-center gap-2 text-brand-gold font-bold text-sm">
                <Radio className="w-4 h-4" />
                <span>High-Definition Streaming</span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Master-quality audio with dynamic tempo and BPM matching across all breakbeat sub-genres.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-950/60 border border-white/5 space-y-1.5">
              <div className="flex items-center gap-2 text-brand-neon font-bold text-sm">
                <Film className="w-4 h-4" />
                <span>Cultural Documentaries</span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Archival park jam footage, artist portraits, and deep production masterclasses.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-950/60 border border-white/5 space-y-1.5">
              <div className="flex items-center gap-2 text-brand-purple font-bold text-sm">
                <BookOpen className="w-4 h-4" />
                <span>Narrated Audiobooks</span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Definitive cultural sagas tracking the genesis and evolution of sampling history.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-950/60 border border-white/5 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <Disc className="w-4 h-4" />
                <span>Limited Heavyweight Vinyl</span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Tangible physical collector artifacts crafted for dedicated crate enthusiasts.
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs sm:text-sm text-neutral-400">
        <div className="flex flex-wrap items-center gap-6">
          <Link href="/about" className="hover:text-brand-gold transition-colors flex items-center gap-1">
            <span>About</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
          <Link href="/support" className="hover:text-brand-gold transition-colors flex items-center gap-1">
            <span>Support Center</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
          <Link href="/terms" className="hover:text-brand-gold transition-colors flex items-center gap-1">
            <span>Terms of Service</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
          <Link href="/privacy" className="hover:text-brand-gold transition-colors flex items-center gap-1">
            <span>Privacy Policy</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <p className="text-neutral-500">
          © 2026 8 OF SPADES WORKS. All rights reserved.
        </p>
      </div>
    </div>
  );
}
