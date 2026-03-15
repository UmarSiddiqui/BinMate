#!/usr/bin/env ruby
# Adds BinMate source files to the Xcode project and removes boilerplate.
# Run with: ruby scripts/add_sources_to_xcode.rb

$LOAD_PATH.unshift(File.expand_path('~/.gem/ruby/2.6.0/gems/xcodeproj-1.27.0/lib'))
require 'xcodeproj'

PROJ_PATH  = File.expand_path('../ios/Bin Mate/Bin Mate.xcodeproj', __dir__)
SRC_ROOT   = File.expand_path('../ios/Bin Mate/Bin Mate', __dir__)
ADD_GROUPS = %w[App Core Features UI]
BOILERPLATE = %w[Bin_MateApp.swift ContentView.swift]

project = Xcodeproj::Project.open(PROJ_PATH)
target  = project.targets.find { |t| t.name == 'Bin Mate' }
raise "Target 'Bin Mate' not found" unless target

main_group = project.main_group['Bin Mate']
raise "Main group 'Bin Mate' not found" unless main_group

# ── Remove boilerplate ────────────────────────────────────────────────────────
BOILERPLATE.each do |filename|
  ref = main_group.files.find { |f| f.path == filename }
  next unless ref
  target.source_build_phase.files_references.delete(ref)
  ref.remove_from_project
  disk_path = File.join(SRC_ROOT, filename)
  File.delete(disk_path) if File.exist?(disk_path)
  puts "  removed boilerplate: #{filename}"
end

# ── Add groups recursively ────────────────────────────────────────────────────
def add_group(parent_group, dir_path, target)
  dir_name = File.basename(dir_path)

  group = parent_group.find_subpath(dir_name, false) ||
          parent_group.new_group(dir_name, dir_path)

  Dir.foreach(dir_path) do |entry|
    next if entry.start_with?('.')
    full = File.join(dir_path, entry)

    if File.directory?(full)
      add_group(group, full, target)
    elsif entry.end_with?('.swift', '.xib', '.storyboard', '.xcassets',
                           '.strings', '.stringsdict', '.json', '.xcconfig')
      # skip if already referenced
      next if group.files.any? { |f| f.path == entry }

      ref = group.new_file(full)
      ref.source_tree = '<group>'
      ref.path = entry

      if entry.end_with?('.swift')
        target.source_build_phase.add_file_reference(ref)
      elsif entry.end_with?('.xcassets')
        target.resources_build_phase.add_file_reference(ref)
      elsif entry.end_with?('.strings', '.stringsdict')
        target.resources_build_phase.add_file_reference(ref)
      end

      puts "  added: #{File.join(dir_name, entry)}"
    end
  end
end

ADD_GROUPS.each do |group_name|
  dir = File.join(SRC_ROOT, group_name)
  unless Dir.exist?(dir)
    puts "  skipping (not found on disk): #{group_name}"
    next
  end
  add_group(main_group, dir, target)
end

project.save
puts "\nDone — project saved."
