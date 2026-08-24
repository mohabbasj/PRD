'use client';

import { emptyAc, emptyStory, type AcceptanceCriterion, type Story } from '@/lib/types';
import { storyHasContent } from '@/lib/completion';
import { LongTextInput, TextInput } from './primitives';

function CardShell({
  title,
  onDelete,
  children,
}: {
  title: string;
  onDelete?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 rounded border border-rule">
      <div className="flex items-center justify-between border-b border-rule bg-labelfill px-3 py-1.5">
        <span className="text-[12px] font-bold">{title}</span>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="text-[11px] text-hint hover:text-red-700"
          >
            Remove
          </button>
        )}
      </div>
      <div className="px-3 py-3">{children}</div>
    </div>
  );
}

export default function StoriesField({
  stories,
  onChange,
}: {
  stories: Story[];
  onChange: (s: Story[]) => void;
}) {
  const patch = (id: string, changes: Partial<Story>) =>
    onChange(stories.map((s) => (s._id === id ? { ...s, ...changes } : s)));

  const removeStory = (story: Story) => {
    if (storyHasContent(story) && !window.confirm('This story has content. Delete it?')) return;
    onChange(stories.filter((s) => s._id !== story._id));
  };

  const patchAc = (storyId: string, acId: string, changes: Partial<AcceptanceCriterion>) =>
    onChange(
      stories.map((s) =>
        s._id === storyId
          ? { ...s, acceptance: s.acceptance.map((a) => (a._id === acId ? { ...a, ...changes } : a)) }
          : s
      )
    );

  return (
    <div>
      {stories.map((story, i) => (
        // Stories are numbered by position, so a delete or reorder renumbers the rest.
        <CardShell
          key={story._id}
          title={`Story ${i + 1}`}
          onDelete={stories.length > 1 ? () => removeStory(story) : undefined}
        >
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-2 text-[12px]">
            <span className="text-muted">As a</span>
            <span className="min-w-[9rem] flex-1">
              <TextInput
                value={story.as_a}
                onChange={(v) => patch(story._id, { as_a: v })}
                placeholder="user"
              />
            </span>
            <span className="text-muted">, I want</span>
            <span className="min-w-[12rem] flex-[2]">
              <TextInput
                value={story.i_want}
                onChange={(v) => patch(story._id, { i_want: v })}
                placeholder="capability"
              />
            </span>
            <span className="text-muted">so that</span>
            <span className="min-w-[12rem] flex-[2]">
              <TextInput
                value={story.so_that}
                onChange={(v) => patch(story._id, { so_that: v })}
                placeholder="outcome"
              />
            </span>
            <span className="text-muted">.</span>
          </div>

          <div className="mt-3">
            <LongTextInput
              value={story.notes}
              onChange={(v) => patch(story._id, { notes: v })}
              lines={1}
              placeholder="Notes"
            />
          </div>

          <p className="mt-3 text-hint italic text-hint">
            Acceptance criteria: Given [state], when [action], then [result].
          </p>
          <table className="mt-1 w-full table-fixed border-collapse">
            <colgroup>
              <col style={{ width: '32%' }} />
              <col style={{ width: '32%' }} />
              <col style={{ width: '32%' }} />
              <col style={{ width: '4%' }} />
            </colgroup>
            <thead>
              <tr className="bg-headfill">
                {['Given', 'When', 'Then'].map((h) => (
                  <th key={h} className="border border-rule px-2 py-1 text-left text-[11px] font-bold">
                    {h}
                  </th>
                ))}
                <th className="border border-rule" />
              </tr>
            </thead>
            <tbody>
              {story.acceptance.map((ac) => (
                <tr key={ac._id}>
                  {(['given', 'when', 'then'] as const).map((key) => (
                    <td key={key} className="border border-rule align-top">
                      <TextInput
                        value={ac[key]}
                        onChange={(v) => patchAc(story._id, ac._id, { [key]: v })}
                        bordered={false}
                      />
                    </td>
                  ))}
                  <td className="border border-rule text-center align-top">
                    {story.acceptance.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          patch(story._id, {
                            acceptance: story.acceptance.filter((a) => a._id !== ac._id),
                          })
                        }
                        className="px-1 py-1 text-[11px] text-hint hover:text-red-700"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            onClick={() => patch(story._id, { acceptance: [...story.acceptance, emptyAc()] })}
            className="mt-1.5 text-[11px] text-muted hover:text-ink hover:underline"
          >
            + Add criterion
          </button>
        </CardShell>
      ))}

      <button
        type="button"
        onClick={() => onChange([...stories, emptyStory()])}
        className="text-[11px] text-muted hover:text-ink hover:underline"
      >
        + Add story
      </button>
    </div>
  );
}
